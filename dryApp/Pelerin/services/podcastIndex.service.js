/**
 * Service de découverte Podcast Index (dryApp/Pelerin).
 *
 * Podcast Index est une source de découverte OUVERTE (agrégateur de flux RSS).
 * Les résultats ne sont JAMAIS publiés automatiquement : ils ne servent qu'à
 * la recherche admin, qui choisit ensuite les podcasts à importer via le flux
 * RSS (import RSS manuel existant).
 *
 * Les credentials API restent EXCLUSIVEMENT côté backend (variables
 * d'environnement PODCASTINDEX_API_KEY / PODCASTINDEX_API_SECRET) — jamais
 * exposés à l'application mobile.
 *
 * Authentification Podcast Index (API 1.0) :
 *   User-Agent   : obligatoire
 *   X-Auth-Key   : clé API
 *   X-Auth-Date  : epoch UNIX en secondes
 *   Authorization: SHA1(apiKey + apiSecret + epoch)
 */
const crypto = require('crypto');
const axios = require('axios');

// Endpoint par défaut de l'API Podcast Index — surchargeable via
// PODCASTINDEX_API_BASE (ex: proxy/miroir, sandbox).
const API_BASE_DEFAULT = 'https://api.podcastindex.org/api/1.0';
const SEARCH_TIMEOUT_MS = 10000;
const DEFAULT_MAX = 25;

/** URL de base effective (env PODCASTINDEX_API_BASE, sinon défaut). */
function getApiBase() {
  return String(process.env.PODCASTINDEX_API_BASE || API_BASE_DEFAULT).replace(/\/+$/, '');
}

// Cache mémoire court (TTL 60 s) : évite de marteler l'API tierce quand
// l'admin retouche sa recherche. Par processus — suffisant pour une app.
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Mots-clés (catégories/noms) rattachés à la spiritualité / religion.
const SPIRITUAL_HINTS = [
  'religion',
  'spiritual',
  'spirituel',
  'église',
  'eglise',
  'catholique',
  'chrétien',
  'chretien',
  'christian',
  'catholic',
  'bible',
  'biblical',
  'évangile',
  'evangile',
  'foi',
  'jésus',
  'jesus',
  'prie',
  'prière',
  'priere',
  'louange',
  'adorat',
  'protestant',
  'orthodoxe',
];

function getCredentials() {
  const apiKey = process.env.PODCASTINDEX_API_KEY || '';
  const apiSecret = process.env.PODCASTINDEX_API_SECRET || '';
  return { apiKey, apiSecret };
}

function buildHeaders() {
  const { apiKey, apiSecret } = getCredentials();
  if (!apiKey || !apiSecret) {
    throw Object.assign(new Error('Podcast Index non configuré (credentials manquants côté serveur)'), {
      code: 'PODCAST_INDEX_NOT_CONFIGURED',
    });
  }
  const epoch = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(`${apiKey}${apiSecret}${epoch}`).digest('hex');
  return {
    'User-Agent': 'LePelerin-PodcastBot/1.0 (+https://lepelerin.app)',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(epoch),
    Authorization: hash,
  };
}

function isFrancophone(feed) {
  return /^fr/i.test(String(feed.language || ''));
}

function isSpiritual(feed) {
  const haystack = [
    feed.title,
    feed.author,
    feed.description,
    ...Object.values(feed.categories || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return SPIRITUAL_HINTS.some((hint) => haystack.includes(hint.toLowerCase()));
}

/**
 * Recherche sur Podcast Index, filtrée pour la découverte francophone /
 * chrétienne (le filtre est un tri préférentiel : les résultats non-français
 * et non-spirituels sont retirés, l'admin reste libre de chercher autrement).
 * @param {string} q
 * @param {number} max
 * @returns {Promise<object[]>}
 */
async function searchPodcastIndex({ q, max = DEFAULT_MAX }) {
  const key = `q:${q.trim().toLowerCase()}:${max}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.data;
  }

  const { data } = await axios.get(`${getApiBase()}/search/byterm`, {
    params: { q, max: Math.min(50, Math.max(1, max)), fulltext: false },
    headers: buildHeaders(),
    timeout: SEARCH_TIMEOUT_MS,
  });

  if (!data || data.status !== 'true' || !Array.isArray(data.feeds)) {
    throw new Error('Réponse Podcast Index invalide');
  }

  const results = data.feeds
    .map((f) => ({
      feedId: f.id,
      title: f.title || '',
      author: f.author || '',
      description: (f.description || '').slice(0, 500),
      imageUrl: f.image || '',
      language: f.language || '',
      websiteUrl: f.link || '',
      rssUrl: f.url || '',
      categories: Object.values(f.categories || {}),
      score: Number(f.score) || 0,
      isFrancophone: isFrancophone(f),
      isSpiritual: isSpiritual(f),
    }))
    // Découverte ciblée : on garde ce qui est francophone ou spirituel.
    .filter((r) => r.rssUrl && (r.isFrancophone || r.isSpiritual))
    // Pertinence : score de l'API d'abord, bonus langue/catégorie ensuite
    // (poids configurables via PODCAST_SCORE_DISCOVER_LANGUE / _SPIRITUEL).
    .sort((a, b) => {
      const bonus = (r) => {
        const lang = Number(process.env.PODCAST_SCORE_DISCOVER_LANGUE ?? 5);
        const spir = Number(process.env.PODCAST_SCORE_DISCOVER_SPIRITUEL ?? 3);
        return r.score + (r.isFrancophone ? lang : 0) + (r.isSpiritual ? spir : 0);
      };
      return bonus(b) - bonus(a);
    });

  cache.set(key, { ts: Date.now(), data: results });
  return results;
}

module.exports = {
  searchPodcastIndex,
  buildHeaders,
  getApiBase,
  isFrancophone,
  isSpiritual,
  CACHE_TTL_MS,
};
