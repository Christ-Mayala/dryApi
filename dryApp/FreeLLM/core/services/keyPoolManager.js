const crypto = require('crypto');
const { logger, circuitBreaker } = require('./inferenceLogger');

// Reference to ApiKeysModel for persistent blacklisting — set at startup
let _ApiKeysModel = null;
function setApiKeysModel(model) { _ApiKeysModel = model; }

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
 * @property {'active' | 'invalid' | 'cooldown'} status
 * @property {number | null} disabledAt
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

/**
 * @typedef {Object} ProviderMetrics
 * @property {number} totalRequests
 * @property {number} successCount
 * @property {number} failureCount
 * @property {number} totalLatencyMs
 * @property {number[]} recentLatencies
 * @property {number} lastUpdatedAt
 * @property {number} priorityBoost
 * @property {boolean} rateLimited
 * @property {number | null} retryAfter
 */

const KEY_POOL = new Map(); // Map<platform, Map<keyId, StoredKey>>
const PROVIDER_METRICS = new Map(); // Map<platform, ProviderMetrics>
const COOLDOWN_MS = 120000;
const RECENT_LATENCY_COUNT = 10;
const MAX_ERRORS_BEFORE_COOLDOWN = 3;
const PROVIDER_METRICS_DECAY_MS = 3600000;

// IDE Mode preferred providers
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
 * Initialize KeyPoolManager from DB
 */
async function initializeKeyPool(ApiKeysModel) {
  logger.debug('[KEYPOOL]', {
    event: 'INITIALIZE_START'
  });
  const keys = await ApiKeysModel.find({ deletedAt: null, enabled: true }).lean();

  for (const key of keys) {
    const platform = key.platform;
    if (!KEY_POOL.has(platform)) {
      KEY_POOL.set(platform, new Map());
    }

    if (!PROVIDER_METRICS.has(platform)) {
      PROVIDER_METRICS.set(platform, {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastUpdatedAt: Date.now(),
        priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
        rateLimited: false,
        retryAfter: null
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
        recentErrors: [],
        status: 'active',
        disabledAt: null
      }
    });
  }

  logger.debug('[KEYPOOL]', {
    event: 'INITIALIZE_COMPLETE',
    keyCount: keys.length,
    platformCount: KEY_POOL.size
  });
}

/**
 * Decay old provider metrics to keep scores fresh
 */
function decayProviderMetrics() {
  const now = Date.now();
  for (const [platform, metrics] of PROVIDER_METRICS) {
    const elapsed = now - metrics.lastUpdatedAt;
    if (elapsed > PROVIDER_METRICS_DECAY_MS) {
      metrics.totalRequests = Math.floor(metrics.totalRequests * 0.5);
      metrics.successCount = Math.floor(metrics.successCount * 0.5);
      metrics.failureCount = Math.floor(metrics.failureCount * 0.5);
      metrics.totalLatencyMs = Math.floor(metrics.totalLatencyMs * 0.5);
      metrics.recentLatencies = metrics.recentLatencies.slice(Math.floor(metrics.recentLatencies.length / 2));
      metrics.lastUpdatedAt = now;

      if (metrics.retryAfter && now > metrics.retryAfter) {
        metrics.rateLimited = false;
        metrics.retryAfter = null;
      }
    }
  }
}

/**
 * Get dynamic provider score with real-time metrics
 */
function getProviderScore(platform) {
  decayProviderMetrics();
  const metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) return IDE_PREFERRED_PROVIDERS[platform] || 0;

  let score = metrics.priorityBoost;

  if (metrics.rateLimited) {
    score -= 1000;
  }

  if (metrics.totalRequests > 0) {
    const successRate = metrics.successCount / metrics.totalRequests;
    score += successRate * 300;
  }

  if (metrics.recentLatencies.length > 0) {
    const avgLatency = metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length;
    const latencyScore = Math.max(0, 200 * (1 - avgLatency / 3000));
    score += latencyScore;
  }

  return score;
}

/**
 * Get sorted list of platforms by dynamic score
 */
function getSortedPlatforms() {
  return Array.from(PROVIDER_METRICS.keys())
    .sort((a, b) => getProviderScore(b) - getProviderScore(a));
}

/**
 * Get the best available key for a platform
 */
function getBestKey(platform) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;

  const now = Date.now();
  let bestKey = null;
  let bestScore = -Infinity;

  for (const [keyId, key] of platformKeys) {
    if (key.stats.status !== 'active') continue;
    if (key.stats.cooldownUntil && now < key.stats.cooldownUntil) continue;

    const score = calculateKeyScore(key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

/**
 * Calculate a dynamic score for a key
 */
function calculateKeyScore(key) {
  const { stats } = key;
  let score = 50;

  if (stats.totalRequests > 0) {
    const successRate = stats.successCount / stats.totalRequests;
    score += successRate * 30;
  }

  if (stats.recentLatencies.length > 0) {
    const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
    const latencyScore = Math.max(0, 20 * (1 - avgLatency / 5000));
    score += latencyScore;
  }

  const recencyMs = Date.now() - stats.lastUsedAt;
  const recencyScore = Math.max(0, 10 * (1 - recencyMs / (3600000 * 24)));
  score += recencyScore;

  return score;
}

/**
 * Record a successful request for a key AND provider
 */
function recordKeySuccess(platform, keyId, latencyMs) {
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

  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
      rateLimited: false,
      retryAfter: null
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

  circuitBreaker.recordSuccess(platform);

  logger.debug('[KEYPOOL]', {
    event: 'KEY_SUCCESS',
    provider: platform,
    keyId,
    latencyMs
  });
}

/**
 * Extract retry delay from error message
 */
function extractRetryDelay(errorMessage) {
  if (!errorMessage) return null;

  const patterns = [
    /retry after (\d+(?:\.\d+)?)/i,
    /retry in (\d+(?:\.\d+)?)/i,
    /try again in (\d+(?:\.\d+)?)/i,
    /wait (\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      const delay = parseFloat(match[1]);
      if (!isNaN(delay)) {
        return Math.ceil(delay * 1000);
      }
    }
  }

  return null;
}

/**
 * Record a failed request for a key AND provider
 */
function recordKeyFailure(platform, keyId, errorMessage) {
  if (errorMessage && errorMessage.toLowerCase().includes('aborted')) {
    logger.debug('[KEYPOOL]', {
      event: 'IGNORE_ABORTED',
      provider: platform,
      keyId
    });
    return;
  }

  const now = Date.now();
  let cooldownMs = COOLDOWN_MS;
  let keyStatus = 'active';
  let providerRateLimited = false;
  let providerRetryAfter = null;

  if (errorMessage && (errorMessage.toLowerCase().includes('401') || errorMessage.toLowerCase().includes('user not found'))) {
    cooldownMs = 24 * 60 * 60 * 1000;
    keyStatus = 'invalid';
    logger.event('KEY_BLACKLISTED', {
      provider: platform,
      keyId,
      reason: '401_UNAUTHORIZED',
      cooldownUntil: now + cooldownMs
    });
  } else if (errorMessage && (errorMessage.toLowerCase().includes('403'))) {
    cooldownMs = 24 * 60 * 60 * 1000;
    keyStatus = 'invalid';
    logger.event('KEY_BLACKLISTED', {
      provider: platform,
      keyId,
      reason: '403_FORBIDDEN',
      cooldownUntil: now + cooldownMs
    });
  } else if (errorMessage && (errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('quota exceeded'))) {
    const extractedDelay = extractRetryDelay(errorMessage);
    if (extractedDelay) {
      cooldownMs = extractedDelay;
      providerRateLimited = true;
      providerRetryAfter = now + extractedDelay;
    } else {
      cooldownMs = 60 * 1000;
      providerRateLimited = true;
      providerRetryAfter = now + cooldownMs;
    }
    logger.event('RATE_LIMITED', {
      provider: platform,
      keyId,
      cooldownMs,
      retryAfter: providerRetryAfter
    });
  }

  const platformKeys = KEY_POOL.get(platform);
  if (platformKeys) {
    const key = platformKeys.get(keyId);
    if (key) {
      const stats = key.stats;
      stats.totalRequests++;
      stats.failureCount++;
      stats.lastUsedAt = now;

      stats.recentErrors.push(errorMessage);
      if (stats.recentErrors.length > 5) {
        stats.recentErrors.shift();
      }

      stats.cooldownUntil = now + cooldownMs;
      stats.status = keyStatus;
      if (keyStatus === 'invalid') {
        stats.disabledAt = now;
        // Persist to DB asynchronously so dead key is never retried after restart
        if (_ApiKeysModel) {
          _ApiKeysModel.updateOne(
            { _id: keyId },
            { $set: { status: 'invalid', enabled: false } }
          ).catch(dbErr => {
            logger.debug('[KEYPOOL]', { event: 'DB_BLACKLIST_FAILED', keyId, error: dbErr.message });
          });
        }
      }
    }
  }

  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
      rateLimited: false,
      retryAfter: null
    };
    PROVIDER_METRICS.set(platform, metrics);
  }

  metrics.totalRequests++;
  metrics.failureCount++;
  metrics.lastUpdatedAt = Date.now();

  if (providerRateLimited) {
    metrics.rateLimited = true;
    metrics.retryAfter = providerRetryAfter;
  }

  circuitBreaker.recordFailure(platform);

  logger.debug('[KEYPOOL]', {
    event: 'KEY_FAILURE',
    provider: platform,
    keyId,
    errorMessage
  });
}

/**
 * Get stats for a key
 */
function getKeyStats(platform, keyId) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;

  const key = platformKeys.get(keyId);
  if (!key) return null;

  return key.stats;
}

/**
 * Get all stats for all providers and keys
 */
function getAllStats() {
  const stats = {
    providers: {},
    keys: {}
  };

  for (const [platform, metrics] of PROVIDER_METRICS) {
    stats.providers[platform] = {
      ...metrics,
      score: getProviderScore(platform),
      circuitBreaker: circuitBreaker.getState(platform)
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
  setApiKeysModel,
  getBestKey,
  recordKeySuccess,
  recordKeyFailure,
  getKeyStats,
  getProviderScore,
  getSortedPlatforms,
  getAllStats,
  IDE_PREFERRED_PROVIDERS
};
