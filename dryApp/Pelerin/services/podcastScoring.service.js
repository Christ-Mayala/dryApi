/**
 * Service de scoring de pertinence des podcasts (dryApp/Pelerin).
 *
 * Utilisé par le pipeline d'import automatique (découverte Podcast Index
 * planifiée) pour décider du sort de chaque podcast importé :
 *
 *   Score ≥ PODCAST_SCORE_AUTO_PUBLISH (défaut 80) → publication automatique (autoPublishStatus = 'auto')
 *   Score ≥ PODCAST_SCORE_PENDING_MIN  (défaut 50) → validation admin        (autoPublishStatus = 'pending')
 *   Score <  PODCAST_SCORE_PENDING_MIN  (défaut 50) → rejet automatique       (autoPublishStatus = 'rejected')
 *
 * Le score est aussi calculé (à titre indicatif) pour les imports manuels de
 * l'administrateur, mais il ne gate jamais une décision explicite de l'admin.
 *
 * Tous les poids sont configurables via variables d'environnement
 * (PODCAST_SCORE_*), lus à chaque appel pour rester testables. Défauts (spec
 * produit) :
 *   langue française                    +PODCAST_SCORE_LANGUE (20)
 *   "chrétien" dans le titre            +PODCAST_SCORE_TITRE_CHRETIEN (25)
 *   "Bible" dans le titre               +PODCAST_SCORE_TITRE_BIBLE (25)
 *   "Jésus" dans le titre               +PODCAST_SCORE_TITRE_JESUS (25)
 *   "évangile" dans le titre            +PODCAST_SCORE_TITRE_EVANGILE (15)
 *   "prière" dans le titre              +PODCAST_SCORE_TITRE_PRIERE (15)
 *   foi / spiritualité dans le titre    +PODCAST_SCORE_TITRE_FOI (10)
 *   "méditation" dans le titre          +PODCAST_SCORE_TITRE_MEDITATION (10)
 *   "évangile" en description           +PODCAST_SCORE_DESC_EVANGILE (15)
 *   "prière" en description             +PODCAST_SCORE_DESC_PRIERE (15)
 *   thématique chrétienne en desc.      +PODCAST_SCORE_DESC_CHRETIEN (10)
 *   référence biblique en desc.         +PODCAST_SCORE_DESC_BIBLE (10)
 *   Jésus-Christ en desc.               +PODCAST_SCORE_DESC_JESUS (10)
 *   communauté chrétienne en desc.      +PODCAST_SCORE_DESC_COMMUNAUTE (10)
 *   méditation en desc.                 +PODCAST_SCORE_DESC_MEDITATION (8)
 *   louange / adoration en desc.        +PODCAST_SCORE_DESC_LOUANGE (8)
 *   catégorie religion/spiritualité     +PODCAST_SCORE_CATEGORIE (10)
 *   RSS valide (flux parsable)          +PODCAST_SCORE_RSS_VALIDE (10)
 */

// Surcharges persistées (base de données) — priorité sur les variables
// d'environnement. Chargées au démarrage (server.js) et rafraîchies par le
// contrôleur de configuration admin. Structure :
//   { weights: { PODCAST_SCORE_LANGUE: 30, ... }, thresholds: { PODCAST_SCORE_AUTO_PUBLISH: 85 } }
let scoringOverrides = null;

/** Définit les surcharges en cache (appelé après lecture/écriture en base). */
const setScoringOverrides = (overrides) => {
  scoringOverrides = overrides && typeof overrides === 'object' ? overrides : null;
  return scoringOverrides;
};

/**
 * Charge les surcharges persistées depuis le modèle PodcastScoringConfig
 * (document singleton) et met à jour le cache. Retourne les surcharges actives.
 * @param {import('mongoose').Model} [ConfigModel]
 * @returns {Promise<object|null>}
 */
async function loadScoringOverrides(ConfigModel) {
  if (!ConfigModel) return setScoringOverrides(null);
  const doc = await ConfigModel.findOne().lean();
  if (!doc) return setScoringOverrides(null);
  return setScoringOverrides({
    weights: doc.weights || {},
    thresholds: doc.thresholds || {},
  });
}

/** Lit un poids (surcharge persistée > env > défaut). */
const envWeight = (name, fallback) => {
  if (scoringOverrides?.weights && Number.isFinite(scoringOverrides.weights[name])) {
    return scoringOverrides.weights[name];
  }
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Lit un seuil de décision (surcharge persistée > env > défaut). */
const threshold = (name, fallback) => {
  if (scoringOverrides?.thresholds && Number.isFinite(scoringOverrides.thresholds[name])) {
    return scoringOverrides.thresholds[name];
  }
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};


const AUTO_PUBLISH_THRESHOLD = () => threshold('PODCAST_SCORE_AUTO_PUBLISH', 80);
const PENDING_THRESHOLD = () => threshold('PODCAST_SCORE_PENDING_MIN', 50);

// Mots-clés du TITRE (poids fort : un titre explicite est le meilleur signal).
const TITLE_KEYWORDS = [
  { pattern: /chrétien|chretien|christian/i, points: () => envWeight('PODCAST_SCORE_TITRE_CHRETIEN', 25), env: 'PODCAST_SCORE_TITRE_CHRETIEN', label: '"chrétien" dans le titre' },
  { pattern: /bibl(e|ique|es)/i, points: () => envWeight('PODCAST_SCORE_TITRE_BIBLE', 25), env: 'PODCAST_SCORE_TITRE_BIBLE', label: '"Bible" dans le titre' },
  { pattern: /jésus|jesus/i, points: () => envWeight('PODCAST_SCORE_TITRE_JESUS', 25), env: 'PODCAST_SCORE_TITRE_JESUS', label: '"Jésus" dans le titre' },
  { pattern: /évangile|evangile/i, points: () => envWeight('PODCAST_SCORE_TITRE_EVANGILE', 15), env: 'PODCAST_SCORE_TITRE_EVANGILE', label: '"Évangile" dans le titre' },
  { pattern: /pri[èe]re/i, points: () => envWeight('PODCAST_SCORE_TITRE_PRIERE', 15), env: 'PODCAST_SCORE_TITRE_PRIERE', label: '"Prière" dans le titre' },
  { pattern: /foi|spirituel/i, points: () => envWeight('PODCAST_SCORE_TITRE_FOI', 10), env: 'PODCAST_SCORE_TITRE_FOI', label: 'foi / spiritualité dans le titre' },
  { pattern: /méditation|meditation/i, points: () => envWeight('PODCAST_SCORE_TITRE_MEDITATION', 10), env: 'PODCAST_SCORE_TITRE_MEDITATION', label: '"Méditation" dans le titre' },
];

// Mots-clés de la DESCRIPTION (poids moyen).
const DESC_KEYWORDS = [
  { pattern: /évangile|evangile/i, points: () => envWeight('PODCAST_SCORE_DESC_EVANGILE', 15), env: 'PODCAST_SCORE_DESC_EVANGILE', label: '"évangile" dans la description' },
  { pattern: /pri[èe]re/i, points: () => envWeight('PODCAST_SCORE_DESC_PRIERE', 15), env: 'PODCAST_SCORE_DESC_PRIERE', label: '"prière" dans la description' },
  { pattern: /chrétien|chretien|christian/i, points: () => envWeight('PODCAST_SCORE_DESC_CHRETIEN', 10), env: 'PODCAST_SCORE_DESC_CHRETIEN', label: 'thématique chrétienne' },
  { pattern: /bibl(e|ique|es)|écriture|ecriture/i, points: () => envWeight('PODCAST_SCORE_DESC_BIBLE', 10), env: 'PODCAST_SCORE_DESC_BIBLE', label: 'référence biblique' },
  { pattern: /jésus|jesus|christ/i, points: () => envWeight('PODCAST_SCORE_DESC_JESUS', 10), env: 'PODCAST_SCORE_DESC_JESUS', label: 'Jésus-Christ' },
  { pattern: /église|eglise|paroisse|protestant|catholique|orthodoxe|pasteur|pr[èe]tre/i, points: () => envWeight('PODCAST_SCORE_DESC_COMMUNAUTE', 10), env: 'PODCAST_SCORE_DESC_COMMUNAUTE', label: 'communauté chrétienne' },
  { pattern: /méditation|meditation/i, points: () => envWeight('PODCAST_SCORE_DESC_MEDITATION', 8), env: 'PODCAST_SCORE_DESC_MEDITATION', label: 'méditation' },
  { pattern: /louange|adorat/i, points: () => envWeight('PODCAST_SCORE_DESC_LOUANGE', 8), env: 'PODCAST_SCORE_DESC_LOUANGE', label: 'louange / adoration' },
];

// Clés valides pour les surcharges persistées (validation côté contrôleur admin).
const WEIGHT_KEYS = [
  'PODCAST_SCORE_LANGUE',
  'PODCAST_SCORE_CATEGORIE',
  'PODCAST_SCORE_RSS_VALIDE',
  ...TITLE_KEYWORDS.map((k) => k.env),
  ...DESC_KEYWORDS.map((k) => k.env),
];
const THRESHOLD_KEYS = ['PODCAST_SCORE_AUTO_PUBLISH', 'PODCAST_SCORE_PENDING_MIN'];

// Catégories (Podcast Index / iTunes) rattachées à la religion / spiritualité.
const CATEGORY_HINTS = [
  'religion',
  'spiritual',
  'spirituel',
  'christian',
  'christianity',
  'catholic',
  'catholique',
  'faith',
  'bible',
  'god',
];

/**
 * Calcule un score de pertinence 0–100 pour un podcast.
 * @param {object} meta
 * @param {string} meta.title
 * @param {string} [meta.author]
 * @param {string} [meta.description]
 * @param {string} [meta.language]
 * @param {string[]} [meta.categories]
 * @param {boolean} [meta.rssValid] — true si le flux a été parsé avec succès
 * @returns {{score: number, breakdown: {label: string, points: number}[]}}
 */
function computePodcastScore({
  title = '',
  author = '',
  description = '',
  language = '',
  categories = [],
  rssValid = true,
}) {
  const breakdown = [];
  let score = 0;

  const add = (label, points) => {
    score += points;
    breakdown.push({ label, points });
  };

  // Langue française (le catalogue du Pèlerin est francophone).
  if (/^fr/i.test(String(language || ''))) {
    add('Langue française', envWeight('PODCAST_SCORE_LANGUE', 20));
  }

  const titleText = `${title || ''} ${author || ''}`.trim();
  for (const kw of TITLE_KEYWORDS) {
    if (kw.pattern.test(titleText)) add(kw.label, kw.points());
  }

  const descText = description || '';
  for (const kw of DESC_KEYWORDS) {
    if (kw.pattern.test(descText)) add(kw.label, kw.points());
  }

  // Catégorie religion / spiritualité (Podcast Index renvoie un objet id → libellé).
  const categoryValues = Object.values(categories || {}).map((c) => String(c).toLowerCase());
  if (categoryValues.some((c) => CATEGORY_HINTS.some((h) => c.includes(h)))) {
    add('Catégorie religion / spiritualité', envWeight('PODCAST_SCORE_CATEGORIE', 10));
  }

  // Flux RSS parsé avec succès (l'import valide le flux avant de créer).
  if (rssValid) {
    add('Flux RSS valide', envWeight('PODCAST_SCORE_RSS_VALIDE', 10));
  }

  return { score: Math.min(100, score), breakdown };
}

/**
 * Décide du sort d'un podcast selon son score (pipeline d'import automatique).
 * Les seuils sont configurables via PODCAST_SCORE_AUTO_PUBLISH /
 * PODCAST_SCORE_PENDING_MIN (défauts 80 / 50).
 * @param {number} score
 * @returns {{status: 'auto'|'pending'|'rejected', isPublished: boolean}}
 */
function decideAutoPublish(score) {
  if (score >= AUTO_PUBLISH_THRESHOLD()) return { status: 'auto', isPublished: true };
  if (score >= PENDING_THRESHOLD()) return { status: 'pending', isPublished: false };
  return { status: 'rejected', isPublished: false };
}

/**
 * État actuel de la configuration du scoring (écran admin de diagnostic) :
 * seuils de décision + poids de chaque critère, avec la variable
 * d'environnement correspondante pour chaque entrée.
 * @returns {{thresholds: {autoPublish: number, pendingMin: number}, weights: object}}
 */
function getScoringConfig() {
  return {
    thresholds: {
      autoPublish: AUTO_PUBLISH_THRESHOLD(),
      pendingMin: PENDING_THRESHOLD(),
    },
    weights: {
      langue: { env: 'PODCAST_SCORE_LANGUE', points: envWeight('PODCAST_SCORE_LANGUE', 20) },
      categorie: { env: 'PODCAST_SCORE_CATEGORIE', points: envWeight('PODCAST_SCORE_CATEGORIE', 10) },
      rssValide: { env: 'PODCAST_SCORE_RSS_VALIDE', points: envWeight('PODCAST_SCORE_RSS_VALIDE', 10) },
      titre: TITLE_KEYWORDS.map((k) => ({ label: k.label, env: k.env, points: k.points() })),
      description: DESC_KEYWORDS.map((k) => ({ label: k.label, env: k.env, points: k.points() })),
    },
    overridesActive: Boolean(
      scoringOverrides &&
        (Object.keys(scoringOverrides.weights || {}).length > 0 ||
          Object.keys(scoringOverrides.thresholds || {}).length > 0),
    ),
  };
}

module.exports = {
  computePodcastScore,
  decideAutoPublish,
  getScoringConfig,
  loadScoringOverrides,
  setScoringOverrides,
  WEIGHT_KEYS,
  THRESHOLD_KEYS,
  TITLE_KEYWORDS,
  DESC_KEYWORDS,
  CATEGORY_HINTS,
};

