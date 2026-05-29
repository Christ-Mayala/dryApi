const crypto = require('crypto');

/**
 * @typedef {Object} KeyStats
 * @property {number} totalRequests
 * @property {number} successCount
 * @property {number} failureCount
 * @property {number} totalLatencyMs
 * @property {number[]} recentLatencies
 * @property {number} lastUsedAt
 * @property {number | null} cooldownUntil
 * @property {string[]} recentErrors
 */

/**
 * @typedef {Object} StoredKey
 * @property {string} id
 * @property {string} platform
 * @property {string} encryptedKey
 * @property {string} iv
 * @property {string} authTag
 * @property {KeyStats} stats
 */

const KEY_POOL = new Map(); // Map<platform, Map<keyId, StoredKey>>
const PROVIDER_METRICS = new Map(); // Map<platform, ProviderMetrics>
const COOLDOWN_MS = 120000; // 2 minutes
const RECENT_LATENCY_COUNT = 10;
const MAX_ERRORS_BEFORE_COOLDOWN = 3;
const PROVIDER_METRICS_DECAY_MS = 3600000; // 1 hour

/**
 * @typedef {Object} ProviderMetrics
 * @property {number} totalRequests
 * @property {number} successCount
 * @property {number} failureCount
 * @property {number} totalLatencyMs
 * @property {number[]} recentLatencies
 * @property {number} lastUpdatedAt
 * @property {number} priorityBoost // For IDE mode preferred providers
 */

// IDE Mode preferred providers with priority boosts (based on actual available providers)
const IDE_PREFERRED_PROVIDERS = {
  'groq': 1000,
  'nvidia': 900,
  'cerebras': 850,
  'sambanova': 700,
  'openrouter': 600,
  'mistral': 500,
  'google': 400,
  'github': 350,
  'cohere': 300,
  'cloudflare': 250,
  'zhipu': 200,
  'ollama': 150,
  'kilo': 100,
  'pollinations': 80,
  'llm7': 50,
  'openai': 0
};

/**
 * Initialize the Key Pool Manager with API keys from the database
 * @param {any} ApiKeysModel Mongoose model for API keys
 */
async function initializeKeyPool(ApiKeysModel) {
  console.log('[KeyPoolManager] Initializing key pool...');
  const keys = await ApiKeysModel.find({ enabled: true, status: { $ne: 'invalid' }, deletedAt: null }).lean();
  
  for (const key of keys) {
    const platform = key.platform;
    if (!KEY_POOL.has(platform)) {
      KEY_POOL.set(platform, new Map());
    }
    
    // Initialize provider metrics if not exists
    if (!PROVIDER_METRICS.has(platform)) {
      PROVIDER_METRICS.set(platform, {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastUpdatedAt: Date.now(),
        priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0
      });
    }
    
    const keyId = String(key._id);
    KEY_POOL.get(platform).set(keyId, {
      id: keyId,
      platform,
      encryptedKey: key.encryptedKey,
      iv: key.iv,
      authTag: key.authTag,
      stats: {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastUsedAt: 0,
        cooldownUntil: null,
        recentErrors: []
      }
    });
  }
  
  console.log(`[KeyPoolManager] Initialized with ${keys.length} keys across ${KEY_POOL.size} platforms`);
}

/**
 * Decay old provider metrics to keep scoring fresh
 */
function decayProviderMetrics() {
  const now = Date.now();
  for (const [platform, metrics] of PROVIDER_METRICS) {
    const elapsed = now - metrics.lastUpdatedAt;
    if (elapsed > PROVIDER_METRICS_DECAY_MS) {
      // Decay metrics by 50% to prioritize recent performance
      metrics.totalRequests = Math.floor(metrics.totalRequests * 0.5);
      metrics.successCount = Math.floor(metrics.successCount * 0.5);
      metrics.failureCount = Math.floor(metrics.failureCount * 0.5);
      metrics.totalLatencyMs = Math.floor(metrics.totalLatencyMs * 0.5);
      // Keep only the most recent half of latencies
      metrics.recentLatencies = metrics.recentLatencies.slice(Math.floor(metrics.recentLatencies.length / 2));
      metrics.lastUpdatedAt = now;
    }
  }
}

/**
 * Get dynamic provider score with real-time metrics
 * @param {string} platform
 * @returns {number}
 */
function getProviderScore(platform) {
  decayProviderMetrics();
  const metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) return IDE_PREFERRED_PROVIDERS[platform] || 0;
  
  let score = metrics.priorityBoost;
  
  // Success rate (0-300 points)
  if (metrics.totalRequests > 0) {
    const successRate = metrics.successCount / metrics.totalRequests;
    score += successRate * 300;
  }
  
  // Average latency (0-200 points, lower is better)
  if (metrics.recentLatencies.length > 0) {
    const avgLatency = metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length;
    const latencyScore = Math.max(0, 200 * (1 - avgLatency / 3000)); // 3s max
    score += latencyScore;
  }
  
  return score;
}

/**
 * Get sorted list of platforms by dynamic score
 * @returns {string[]}
 */
function getSortedPlatforms() {
  return Array.from(PROVIDER_METRICS.keys())
    .sort((a, b) => getProviderScore(b) - getProviderScore(a));
}

/**
 * Get the best available key for a platform
 * @param {string} platform Platform name
 * @returns {StoredKey | null} Best available key, or null if none
 */
function getBestKey(platform) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;
  
  const now = Date.now();
  let bestKey = null;
  let bestScore = -Infinity;
  
  for (const [keyId, key] of platformKeys) {
    // Skip keys in cooldown
    if (key.stats.cooldownUntil && now < key.stats.cooldownUntil) {
      continue;
    }
    
    const score = calculateKeyScore(key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  
  return bestKey;
}

/**
 * Calculate a dynamic score for a key based on performance
 * @param {StoredKey} key
 * @returns {number} Score between 0 and 100
 */
function calculateKeyScore(key) {
  const { stats } = key;
  let score = 50; // Base score
  
  // Success rate (0-30 points)
  if (stats.totalRequests > 0) {
    const successRate = stats.successCount / stats.totalRequests;
    score += successRate * 30;
  }
  
  // Average latency (0-20 points, lower is better)
  if (stats.recentLatencies.length > 0) {
    const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
    const latencyScore = Math.max(0, 20 * (1 - avgLatency / 5000));
    score += latencyScore;
  }
  
  // Recency (0-10 points, more recent is better)
  const recencyMs = Date.now() - stats.lastUsedAt;
  const recencyScore = Math.max(0, 10 * (1 - recencyMs / (3600000 * 24))); // 24 hours
  score += recencyScore;
  
  return score;
}

/**
 * Record a successful request for a key AND provider
 * @param {string} platform
 * @param {string} keyId
 * @param {number} latencyMs
 */
function recordKeySuccess(platform, keyId, latencyMs) {
  // First update key metrics
  const platformKeys = KEY_POOL.get(platform);
  if (platformKeys) {
    const key = platformKeys.get(keyId);
    if (key) {
      const stats = key.stats;
      stats.totalRequests++;
      stats.successCount++;
      stats.totalLatencyMs += latencyMs;
      stats.lastUsedAt = Date.now();
      
      stats.recentLatencies.push(latencyMs);
      if (stats.recentLatencies.length > RECENT_LATENCY_COUNT) {
        stats.recentLatencies.shift();
      }
      
      stats.failureCount = Math.max(0, stats.failureCount - 1);
    }
  }
  
  // Now update provider metrics
  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0
    };
    PROVIDER_METRICS.set(platform, metrics);
  }
  
  metrics.totalRequests++;
  metrics.successCount++;
  metrics.totalLatencyMs += latencyMs;
  metrics.recentLatencies.push(latencyMs);
  if (metrics.recentLatencies.length > 20) {
    metrics.recentLatencies.shift();
  }
  metrics.lastUpdatedAt = Date.now();
  
  console.log(`[KeyPoolManager] Success recorded for ${platform}/${keyId} (${latencyMs}ms)`);
}

/**
 * Record a failed request for a key AND provider
 * @param {string} platform
 * @param {string} keyId
 * @param {string} error
 */
function recordKeyFailure(platform, keyId, error) {
  // IGNORE "this operation was aborted" errors - they're often user interruptions/timeouts, not true provider failures
  if (error && error.toLowerCase().includes('aborted')) {
    console.log(`[KeyPoolManager] Ignoring aborted error for ${platform}/${keyId}`);
    return;
  }
  
  // First check for critical error types
  let cooldownMs = COOLDOWN_MS;
  
  // 401 Unauthorized → Permanent blacklist for 24h
  if (error && error.toLowerCase().includes('401') || error && error.toLowerCase().includes('user not found')) {
    console.warn(`[KeyPoolManager] 401 detected for ${platform}/${keyId} - blacklisting for 24h`);
    cooldownMs = 24 * 60 * 60 * 1000;
  }
  
  // 429 Rate Limited → Extract retry delay from error if available
  if (error && error.toLowerCase().includes('429') || error && error.toLowerCase().includes('quota exceeded')) {
    const retryMatch = error.match(/retry in (\d+(\.\d+)?)/);
    if (retryMatch) {
      cooldownMs = Math.ceil(parseFloat(retryMatch[1]) * 1000);
      console.warn(`[KeyPoolManager] 429 detected for ${platform}/${keyId} - cooldown for ${cooldownMs}ms`);
    } else {
      // Default 60s cooldown
      cooldownMs = 60 * 1000;
      console.warn(`[KeyPoolManager] 429 detected for ${platform}/${keyId} - cooldown for ${cooldownMs}ms`);
    }
  }
  
  // First update key metrics
  const platformKeys = KEY_POOL.get(platform);
  if (platformKeys) {
    const key = platformKeys.get(keyId);
    if (key) {
      const stats = key.stats;
      stats.totalRequests++;
      stats.failureCount++;
      stats.lastUsedAt = Date.now();
      
      stats.recentErrors.push(error);
      if (stats.recentErrors.length > 5) {
        stats.recentErrors.shift();
      }
      
      stats.cooldownUntil = Date.now() + cooldownMs;
      console.warn(`[KeyPoolManager] Key ${keyId} on ${platform} put into cooldown until ${new Date(stats.cooldownUntil).toISOString()}`);
    }
  }
  
  // Now update provider metrics
  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0
    };
    PROVIDER_METRICS.set(platform, metrics);
  }
  
  metrics.totalRequests++;
  metrics.failureCount++;
  metrics.lastUpdatedAt = Date.now();
  
  console.warn(`[KeyPoolManager] Failure recorded for ${platform}/${keyId}: ${error}`);
}

/**
 * Get statistics for a key
 * @param {string} platform
 * @param {string} keyId
 * @returns {KeyStats | null}
 */
function getKeyStats(platform, keyId) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;
  
  const key = platformKeys.get(keyId);
  if (!key) return null;
  
  return key.stats;
}

/**
 * Get all statistics for all providers and keys
 * @returns {Object}
 */
function getAllStats() {
  const stats = {
    providers: {},
    keys: {}
  };
  
  for (const [platform, metrics] of PROVIDER_METRICS) {
    stats.providers[platform] = {
      ...metrics,
      score: getProviderScore(platform)
    };
  }
  
  for (const [platform, keys] of KEY_POOL) {
    stats.keys[platform] = Array.from(keys.values()).map(key => ({
      keyId: key.id,
      stats: key.stats,
      score: calculateKeyScore(key)
    }));
  }
  
  return stats;
}

module.exports = {
  initializeKeyPool,
  getBestKey,
  recordKeySuccess,
  recordKeyFailure,
  getKeyStats,
  getProviderScore,
  getSortedPlatforms,
  getAllStats,
  IDE_PREFERRED_PROVIDERS
};