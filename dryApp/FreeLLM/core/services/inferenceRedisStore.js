/**
 * Redis-backed store pour l'état volatil de l'Inference OS.
 * Utilise redis.service.js quand Redis est disponible, sinon fallback en mémoire.
 */

const redisService = require('../../../dry/services/cache/redis.service');

const PREFIX = 'inf:';
const TTL_SECONDS = 3600; // 1 heure par défaut

// In-memory fallback si Redis n'est pas dispo
const memoryStore = new Map();
let redisAvailable = false;

async function ensureRedis() {
  if (!redisAvailable && redisService.isConnected) {
    redisAvailable = true;
  }
  return redisAvailable;
}

// ── Circuit Breaker Store ──
async function getCircuitBreakerState(key) {
  if (await ensureRedis()) {
    const val = await redisService.get(PREFIX + 'cb:' + key);
    return val ? JSON.parse(val) : null;
  }
  return memoryStore.get('cb:' + key) || null;
}

async function setCircuitBreakerState(key, state) {
  const data = JSON.stringify(state);
  if (await ensureRedis()) {
    await redisService.set(PREFIX + 'cb:' + key, state, TTL_SECONDS);
  } else {
    memoryStore.set('cb:' + key, state);
  }
}

async function deleteCircuitBreakerState(key) {
  if (await ensureRedis()) {
    await redisService.del(PREFIX + 'cb:' + key);
  } else {
    memoryStore.delete('cb:' + key);
  }
}

async function getAllCircuitBreakerStates() {
  if (await ensureRedis()) {
    // Redis SCAN pour récupérer toutes les clés cb:*
    const keys = await redisService.client.keys(PREFIX + 'cb:*');
    const states = [];
    for (const key of keys) {
      const val = await redisService.get(key);
      if (val) states.push(JSON.parse(val));
    }
    return states;
  }
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith('cb:'))
    .map(([, v]) => v);
}

// ── Performance Metrics Store ──
async function getPerformanceMetrics(platform, modelId) {
  const key = `${platform}:${modelId}`;
  if (await ensureRedis()) {
    const val = await redisService.get(PREFIX + 'pm:' + key);
    return val ? JSON.parse(val) : null;
  }
  return memoryStore.get('pm:' + key) || null;
}

async function setPerformanceMetrics(platform, modelId, metrics) {
  const key = `${platform}:${modelId}`;
  if (await ensureRedis()) {
    await redisService.set(PREFIX + 'pm:' + key, metrics, TTL_SECONDS);
  } else {
    memoryStore.set('pm:' + key, metrics);
  }
}

async function getAllPerformanceMetrics() {
  if (await ensureRedis()) {
    const keys = await redisService.client.keys(PREFIX + 'pm:*');
    const metrics = [];
    for (const key of keys) {
      const val = await redisService.get(key);
      if (val) metrics.push(JSON.parse(val));
    }
    return metrics;
  }
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith('pm:'))
    .map(([, v]) => v);
}

// ── Response Cache Store ──
async function getCacheEntry(key) {
  if (await ensureRedis()) {
    const val = await redisService.get(PREFIX + 'cache:' + key);
    return val ? JSON.parse(val) : null;
  }
  return memoryStore.get('cache:' + key) || null;
}

async function setCacheEntry(key, value, ttlSeconds = 300) {
  if (await ensureRedis()) {
    await redisService.set(PREFIX + 'cache:' + key, value, ttlSeconds);
  } else {
    memoryStore.set('cache:' + key, value);
  }
}

async function deleteCacheEntry(key) {
  if (await ensureRedis()) {
    await redisService.del(PREFIX + 'cache:' + key);
  } else {
    memoryStore.delete('cache:' + key);
  }
}

async function getCacheStats() {
  if (await ensureRedis()) {
    const keys = await redisService.client.keys(PREFIX + 'cache:*');
    return { size: keys.length, keys: keys.map(k => k.replace(PREFIX + 'cache:', '')) };
  }
  const entries = Array.from(memoryStore.entries()).filter(([k]) => k.startsWith('cache:'));
  return { size: entries.length, keys: entries.map(([k]) => k.replace('cache:', '')) };
}

module.exports = {
  ensureRedis,
  getCircuitBreakerState,
  setCircuitBreakerState,
  deleteCircuitBreakerState,
  getAllCircuitBreakerStates,
  getPerformanceMetrics,
  setPerformanceMetrics,
  getAllPerformanceMetrics,
  getCacheEntry,
  setCacheEntry,
  deleteCacheEntry,
  getCacheStats
};
