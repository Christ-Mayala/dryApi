/**
 * Response Cache — Cache LRU, model-aware, avec TTL configurable.
 *
 * Améliorations :
 * - LRU eviction (pas FIFO)
 * - Model-aware (même prompt, modèles différents → cache séparé)
 * - Stream-safe (ne cache pas les streams interrompus)
 * - Sélectif (ne cache que temp=0, pas de tools)
 * - Stats complètes (hit rate, eviction count)
 *
 * backward-compat : getCacheKey(), get(), set() conservés.
 */

const crypto = require('crypto');
const { logger } = require('./inferenceLogger');

const CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_CACHE_SIZE = 2000;

// ═══ LRU Cache ═══════════════════════════════════════════════
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); this.misses++; return null; }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    entry.hits++;
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs = CACHE_TTL_MS) {
    if (this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value);
      this.evictions++;
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs, hits: 0 });
  }

  has(key) {
    const e = this.cache.get(key);
    if (!e) return false;
    if (Date.now() > e.expiresAt) { this.cache.delete(key); return false; }
    return true;
  }

  delete(key) { return this.cache.delete(key); }
  clear() { this.cache.clear(); }

  getStats() {
    let active = 0, totalHits = 0;
    const now = Date.now();
    for (const [, e] of this.cache) { if (now <= e.expiresAt) { active++; totalHits += e.hits; } }
    return {
      size: active, maxSize: this.maxSize, totalHits: this.hits,
      totalMisses: this.misses, evictions: this.evictions,
      hitRate: this.hits + this.misses > 0
        ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + '%' : '0%',
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [k, e] of this.cache) { if (now > e.expiresAt) this.cache.delete(k); }
  }
}

// ═══ Singleton ═══════════════════════════════════════════════
const memoryCache = new LRUCache(MAX_CACHE_SIZE);
let cleanupInterval = null;

function _ensureCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => memoryCache.cleanup(), 5 * 60 * 1000);
  }
}

// ═══ Public API (backward compatible) ════════════════════════

function getCacheKey(messages, options = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(messages));
  hash.update(JSON.stringify({
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    top_p: options.top_p,
    model: options.model,
  }));
  return hash.digest('hex');
}

function get(cacheKey) {
  _ensureCleanup();
  return memoryCache.get(cacheKey);
}

function set(cacheKey, value, ttlMs = CACHE_TTL_MS) {
  _ensureCleanup();
  // Don't cache error responses
  if (value?.error) return;
  memoryCache.set(cacheKey, value, ttlMs);
}

function clear() { memoryCache.clear(); }

function getStats() { return memoryCache.getStats(); }

/**
 * Check if a request should be cached.
 */
function isCacheable(messages, options = {}) {
  if (options.stream) return false;
  if (options.tools?.length > 0) return false;
  if (options.tool_choice) return false;
  if (options.temperature !== 0 && options.temperature !== undefined) return false;
  return true;
}

module.exports = {
  LRUCache,
  getCacheKey,
  get,
  set,
  clear,
  getStats,
  isCacheable,
};
