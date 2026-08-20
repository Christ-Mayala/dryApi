/**
 * Scheduler des podcasts (dryApp/Pelerin).
 *
 * Le téléphone ne parse JAMAIS de RSS : toute la récupération est centralisée
 * ici (cron node-cron). Deux jobs :
 *
 *   1. Synchronisation RSS (toutes les heures par défaut) — pour les podcasts
 *      déjà approuvés/importés, les nouveaux épisodes sont détectés par guid
 *      et importés automatiquement. Aucune intervention admin requise.
 *
 *   2. Auto-découverte Podcast Index (quotidienne par défaut) — recherche de
 *      nouveaux podcasts chrétiens francophones, scoring de pertinence, puis :
 *          score ≥ 80  → publication automatique
 *          score 50–79 → en attente de validation admin
 *          score < 50  → rejeté (visible dans l'admin, re-publiable à la main)
 *
 * Un flag `running` évite les passes concurrentes ; chaque échec individuel
 * est isolé (les autres podcasts continuent).
 *
 * Configuration :
 *   PODCAST_RSS_SYNC_ENABLED           = true/false   (défaut: true)
 *   PODCAST_RSS_CRON                   = expression   (défaut: toutes les heures)
 *   PODCAST_AUTO_DISCOVER_ENABLED      = true/false   (défaut: true)
 *   PODCAST_AUTO_DISCOVER_CRON         = expression   (défaut: quotidien 04:00)
 *   PODCAST_AUTO_DISCOVER_MAX          = nombre       (défaut: 8 par passe)
 *   PODCAST_INDEX_API_KEY / _SECRET    = credentials Podcast Index (requis)
 *   PODCAST_SCORE_*                    = poids du scoring + seuils 80/50
 *                                        (voir podcastScoring.service.js)
 */
const cron = require('node-cron');
const getModel = require('../../../dry/core/factories/modelFactory');

// Tenant du module : nom du dossier dryApp/Pelerin → DB "PelerinDB".
// IMPORTANT : ne PAS dériver de process.env.APP_NAME — cette variable désigne
// un autre produit (ex. "CyberFusion") et le bootloader monte les routes sur
// le nom du dossier, pas sur APP_NAME.
const PODCAST_APP = 'Pelerin';
const { syncAllPodcasts } = require('./podcastRssSync.service');
const { importPodcastFromRss } = require('./podcastImport.service');
const { searchPodcastIndex } = require('./podcastIndex.service');
const { computePodcastScore } = require('./podcastScoring.service');
const { recordPipelineDecision } = require('./podcastPipeline.service');
const { isCatholicPodcast } = require('./podcastCategorization.service');
const PodcastShowSchema = require('../features/podcastShow/model/podcastShow.schema');
const PodcastEpisodeSchema = require('../features/podcastEpisode/model/podcastEpisode.schema');
const PodcastImportDecisionSchema = require('../features/podcastShow/model/podcastImportDecision.schema');

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseIntSafe = (value, fallback) => {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isNaN(n) ? fallback : n;
};

// Mots-clés de recherche par défaut pour l'auto-découverte (catalogue
// chrétien FR). Surchargeables via PODCAST_DISCOVERY_KEYWORDS (liste séparée
// par des virgules).
const DISCOVERY_KEYWORDS = [
  // Noyau spirituel
  'méditation chrétienne',
  'enseignement biblique',
  'prière chrétienne',
  'évangile',
  'Jésus Christ',
  'louange chrétienne',
  'témoignage chrétien',
  'vie chrétienne',
  // Vie pratique / conseil (catégories produit variées : chaque résultat est
  // ensuite CLASSÉ par titre/description, pas tout en 'foi-spiritualite')
  'développement personnel chrétien',
  'conseil chrétien',
  'famille chrétienne',
  'jeunesse chrétienne',
  'leadership chrétien',
  'couple et mariage chrétien',
  'santé mentale et foi',
];

/** Mots-clés de découverte effectifs (env PODCAST_DISCOVERY_KEYWORDS, sinon défaut). */
function getDiscoveryKeywords() {
  const raw = process.env.PODCAST_DISCOVERY_KEYWORDS;
  if (raw === undefined || raw === null || String(raw).trim() === '') return DISCOVERY_KEYWORDS;
  return String(raw)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

let started = false;
let running = false;

async function runRssSyncNow() {
  if (running) {
    console.log('[PODCAST-RSS] ⏳ Déjà en cours, exécution ignorée.');
    return;
  }
  running = true;
  const appName = PODCAST_APP;
  try {
    const Show = getModel(appName, 'PodcastShow', PodcastShowSchema);
    const Episode = getModel(appName, 'PodcastEpisode', PodcastEpisodeSchema);
    const result = await syncAllPodcasts({ Show, Episode });
    console.log(
      `[PODCAST-RSS] ✅ ${result.ok} podcast(s) synchronisé(s), ${result.failed} en échec` +
        (result.errors.length ? ` — ${result.errors.map((e) => `${e.title}: ${e.error}`).join(' | ')}` : ''),
    );
  } catch (err) {
    console.error('[PODCAST-RSS] ❌ Erreur globale:', err.message);
  } finally {
    running = false;
  }
}

/**
 * Auto-découverte : recherche Podcast Index, score, déduplication, puis import
 * avec le pipeline de décision (auto / pending / rejected).
 * @param {object} [opts] — surcharge pour les tests
 * @returns {Promise<{searched: number, imported: number, skipped: number, results: object[]}>}
 */
async function runAutoDiscoveryNow(opts = {}) {
  const appName = PODCAST_APP;
  const Show = opts.Show || getModel(appName, 'PodcastShow', PodcastShowSchema);
  const Episode = opts.Episode || getModel(appName, 'PodcastEpisode', PodcastEpisodeSchema);
  const Decision = opts.Decision || getModel(appName, 'PodcastImportDecision', PodcastImportDecisionSchema);
  const keywords = opts.keywords || getDiscoveryKeywords();
  const maxPerRun = opts.max ?? parseIntSafe(process.env.PODCAST_AUTO_DISCOVER_MAX, 8);
  const search = opts.search || searchPodcastIndex;

  const report = { searched: 0, imported: 0, skipped: 0, results: [] };

  // 1. Recherches par mot-clé (jamais simultanées, timeout côté service).
  const byRss = new Map();
  for (const keyword of keywords) {
    let results = [];
    try {
      results = await search({ q: keyword, max: 25 });
    } catch (err) {
      if (err?.code === 'PODCAST_INDEX_NOT_CONFIGURED') {
        console.log('[PODCAST-DISCOVER] ℹ️  Podcast Index non configuré — auto-découverte ignorée.');
        return report;
      }
      console.error(`[PODCAST-DISCOVER] ❌ Recherche "${keyword}" : ${err?.message || err}`);
      continue;
    }
    for (const r of results) {
      if (r.rssUrl && !byRss.has(r.rssUrl)) byRss.set(r.rssUrl, r);
    }
  }

  // 2. Déduplication avec le catalogue existant.
  const existing = await Show.find({ rssUrl: { $in: [...byRss.keys()] } }).select('rssUrl').lean();
  const existingSet = new Set(existing.map((s) => s.rssUrl));

  // 3. Exclut le contenu CATHOLIQUE (messes, évangile du jour, communautés
  // religieuses…) : le catalogue est évangélique/charismatique.
  const fresh = [...byRss.values()].filter((r) => !existingSet.has(r.rssUrl));
  report.skippedCatholic = fresh.filter((r) => isCatholicPodcast(r.title, r.description, r.author)).length;
  const candidates = fresh
    .filter((r) => !isCatholicPodcast(r.title, r.description, r.author))
    .map((r) => ({
      ...r,
      scoreData: computePodcastScore({
        title: r.title,
        author: r.author,
        description: r.description,
        language: r.language,
        categories: r.categories || [],
        rssValid: true,
      }),
    }))
    .sort((a, b) => b.scoreData.score - a.scoreData.score)
    .slice(0, maxPerRun);

  report.searched = byRss.size;

  // 4. Import (pipeline de décision appliqué par importPodcastFromRss source='auto').
  for (const candidate of candidates) {
    try {
      const { show, created, decision } = await importPodcastFromRss({
        Show,
        Episode,
        rssUrl: candidate.rssUrl,
        // Pas de catégorie imposée : l'import l'INFÈRE depuis titre + description
        // (podcastCategorization.service.js) pour que chaque podcast atterrisse
        // dans sa vraie catégorie (dev-personnel, famille, jeunesse…).
        category: undefined,
        isPublished: false,
        source: 'auto',
      });
      await recordPipelineDecision({
        Decision,
        show,
        decision,
        source: 'auto',
        action: 'import',
      });
      report.imported += 1;
      report.results.push({
        title: show.title,
        score: candidate.scoreData.score,
        decision: decision?.status || 'manual',
        created,
      });
      console.log(
        `[PODCAST-DISCOVER] ${created ? '➕' : '♻️'} ${show.title} — score ${candidate.scoreData.score} → ${decision?.status || 'manual'}`,
      );
    } catch (err) {
      report.skipped += 1;
      console.error(`[PODCAST-DISCOVER] ❌ Import ${candidate.title} : ${err?.message || err}`);
    }
  }

  console.log(
    `[PODCAST-DISCOVER] ✅ ${report.imported} importé(s), ${report.skipped} en échec (${report.searched} résultat(s) unique(s) trouvé(s))`,
  );
  return report;
}

function startPodcastRssScheduler() {
  if (started) return;
  started = true;

  if (!parseBool(process.env.PODCAST_RSS_SYNC_ENABLED, true)) {
    console.log('[PODCAST-RSS] ℹ️  Synchro RSS désactivée (PODCAST_RSS_SYNC_ENABLED=false).');
    return;
  }

  // Job 1 — épisodes : toutes les heures par défaut.
  const expression = process.env.PODCAST_RSS_CRON || '0 * * * *';
  if (!cron.validate(expression)) {
    console.error(`[PODCAST-RSS] ❌ Expression cron invalide : ${expression}`);
  } else {
    cron.schedule(expression, runRssSyncNow, { timezone: 'Europe/Paris' });
    console.log(`[PODCAST-RSS] 🕐 Scheduler épisodes RSS planifié (${expression})`);
  }

  // Job 2 — auto-découverte : quotidienne par défaut (04:00).
  if (parseBool(process.env.PODCAST_AUTO_DISCOVER_ENABLED, true)) {
    const discoverExpression = process.env.PODCAST_AUTO_DISCOVER_CRON || '0 4 * * *';
    if (!cron.validate(discoverExpression)) {
      console.error(`[PODCAST-DISCOVER] ❌ Expression cron invalide : ${discoverExpression}`);
    } else {
      cron.schedule(discoverExpression, runAutoDiscoveryNow, { timezone: 'Europe/Paris' });
      console.log(`[PODCAST-DISCOVER] 🕐 Auto-découverte planifiée (${discoverExpression})`);
    }
  } else {
    console.log('[PODCAST-DISCOVER] ℹ️  Auto-découverte désactivée (PODCAST_AUTO_DISCOVER_ENABLED=false).');
  }
}

module.exports = {
  startPodcastRssScheduler,
  runRssSyncNow,
  runAutoDiscoveryNow,
  getDiscoveryKeywords,
  DISCOVERY_KEYWORDS,
  PODCAST_APP,
};
