const crypto = require('crypto');

const cache = new Map();
const CACHE_TTL_MS = 300000; // 5 minutes par défaut
const MAX_CACHE_SIZE = 1000;

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
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  
  entry.hits = (entry.hits || 0) + 1;
  return entry.value;
}

function set(cacheKey, value, ttlMs = CACHE_TTL_MS) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  
  cache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    hits: 0
  });
}

function clear() {
  cache.clear();
}

function getStats() {
  let totalHits = 0;
  let totalEntries = 0;
  const now = Date.now();
  
  for (const [key, entry] of cache.entries()) {
    if (now <= entry.expiresAt) {
      totalEntries++;
      totalHits += entry.hits || 0;
    }
  }
  
  return {
    size: totalEntries,
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
