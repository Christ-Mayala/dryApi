const crypto = require('crypto');

const redisStore = require('./inferenceRedisStore');

const CACHE_TTL_MS = 300000; // 5 minutes par défaut
const MAX_CACHE_SIZE = 1000;

// In-memory fallback si Redis n'est pas dispo
const memoryCache = new Map();

function getCacheKey(messages, options = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(messages));
  hash.update(JSON.stringify({
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    top_p: options.top_p,
    model: options.model
  }));
  return hash.digest('hex');
}

function get(cacheKey) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }

  entry.hits = (entry.hits || 0) + 1;
  return entry.value;
}

function set(cacheKey, value, ttlMs = CACHE_TTL_MS) {
  const entry = {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    hits: 0
  };

  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(cacheKey, entry);

  // Persistance asynchrone en arrière-plan
  redisStore.setCacheEntry(cacheKey, entry, Math.ceil(ttlMs / 1000)).catch(() => {});
}

function clear() {
  memoryCache.clear();
  redisStore.getCacheStats().then(stats => {
    const keys = stats.keys || [];
    for (const key of keys) {
      redisStore.deleteCacheEntry('inf:cache:' + key).catch(() => {});
    }
  }).catch(() => {});
}

function getStats() {
  let totalHits = 0;
  let totalEntries = 0;
  const now = Date.now();

  for (const [key, entry] of memoryCache.entries()) {
    if (now <= entry.expiresAt) {
      totalEntries++;
      totalHits += entry.hits || 0;
    }
  }

  // Tentative de récupérer les stats Redis (non bloquant)
  let redisSize = 0;
  redisStore.getCacheStats().then(stats => {
    redisSize = stats.size || 0;
  }).catch(() => {});

  return {
    size: totalEntries + redisSize,
    maxSize: MAX_CACHE_SIZE,
    totalHits
  };
}

module.exports = {
  getCacheKey,
  get,
  set,
  clear,
  getStats
};
