/**
 * Credential Intelligence — Suivi intelligent par clé API.
 *
 * Problème résolu : ne pas marquer "Google = DOWN" quand c'est
 * uniquement la Key 1 qui a un problème.
 *
 * Architecture :
 *
 *   Provider A
 *      ├── Key A1 → HEALTHY    (quota: 72%, rate: 45/min)
 *      ├── Key A2 → RATE_LIMITED (cooldown 30s)
 *      └── Key A3 → QUOTA_EXCEEDED (disabled)
 *
 *   Provider B
 *      ├── Key B1 → HEALTHY
 *      └── Key B2 → HEALTHY
 *
 * Le router choisit la MEILLEURE clé, pas seulement le meilleur provider.
 */

const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// CREDENTIAL STATUS
// ═══════════════════════════════════════════════════════════════

const CredentialStatus = {
  HEALTHY: 'healthy',
  RATE_LIMITED: 'rate_limited',
  QUOTA_EXCEEDED: 'quota_exceeded',
  AUTH_INVALID: 'auth_invalid',
  COOLDOWN: 'cooldown',
  DISABLED: 'disabled',
  UNKNOWN: 'unknown',
};

// ═══════════════════════════════════════════════════════════════
// CREDENTIAL STATE — Tracks one API key
// ═══════════════════════════════════════════════════════════════

class CredentialState {
  constructor(config = {}) {
    this.keyId = config.keyId;
    this.provider = config.provider;
    this.status = CredentialStatus.UNKNOWN;
    this.priority = config.priority || 5;

    // Rate limiting
    this.rateLimit = {
      maxPerMinute: config.maxPerMinute || 60,
      currentMinute: 0,
      minuteStart: Date.now(),
    };

    // Quota tracking
    this.quota = {
      dailyUsed: 0,
      dailyLimit: config.dailyLimit || 10000,
      monthlyUsed: 0,
      monthlyLimit: config.monthlyLimit || 300000,
      tokensUsed: 0,
      tokenLimit: config.tokenLimit || 10000000,
    };

    // Health tracking
    this.health = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1.0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
    };

    // Cooldown
    this.cooldown = {
      active: false,
      until: 0,
      reason: null,
      retryCount: 0,
    };

    // Error history
    this.errors = [];
    this.maxErrors = 50;
  }

  /**
   * Check if this key is usable right now.
   */
  isAvailable() {
    if (this.status === CredentialStatus.DISABLED) return false;
    if (this.status === CredentialStatus.AUTH_INVALID) return false;
    if (this.cooldown.active && Date.now() < this.cooldown.until) return false;
    if (this.status === CredentialStatus.QUOTA_EXCEEDED) return false;
    return true;
  }

  /**
   * Check rate limit.
   */
  checkRateLimit() {
    const now = Date.now();
    if (now - this.rateLimit.minuteStart > 60000) {
      this.rateLimit.currentMinute = 0;
      this.rateLimit.minuteStart = now;
    }
    return this.rateLimit.currentMinute < this.rateLimit.maxPerMinute;
  }

  /**
   * Record a successful request.
   */
  recordSuccess(latencyMs, inputTokens = 0, outputTokens = 0) {
    this.health.totalRequests++;
    this.health.successCount++;
    this.health.consecutiveFailures = 0;
    this.health.lastSuccess = Date.now();
    this.health.totalLatencyMs += latencyMs;
    this.health.avgLatencyMs = this.health.totalLatencyMs / this.health.totalRequests;
    this.health.successRate = this.health.successCount / this.health.totalRequests;

    this.rateLimit.currentMinute++;
    this.quota.dailyUsed++;
    this.quota.monthlyUsed++;
    this.quota.tokensUsed += inputTokens + outputTokens;

    // Clear cooldown if was active
    if (this.cooldown.active) {
      this.cooldown.active = false;
      this.cooldown.retryCount = 0;
    }

    // Update status
    this._updateStatus();
  }

  /**
   * Record a failed request.
   */
  recordFailure(error, category = 'unknown') {
    this.health.totalRequests++;
    this.health.failureCount++;
    this.health.consecutiveFailures++;
    this.health.lastFailure = Date.now();
    this.health.successRate = this.health.totalRequests > 0
      ? this.health.successCount / this.health.totalRequests
      : 0;

    this.rateLimit.currentMinute++;

    // Record error
    this.errors.push({ category, timestamp: Date.now(), error: String(error).slice(0, 200) });
    if (this.errors.length > this.maxErrors) this.errors.shift();

    // Handle specific error categories
    switch (category) {
      case 'rate_limit':
        this.status = CredentialStatus.RATE_LIMITED;
        this._activateCooldown(60000, 'rate_limit');
        break;
      case 'quota_exceeded':
        this.status = CredentialStatus.QUOTA_EXCEEDED;
        break;
      case 'auth_error':
      case 'permission_denied':
        this.status = CredentialStatus.AUTH_INVALID;
        break;
      case 'timeout':
      case 'network_error':
      case 'server_error':
        this._activateCooldown(this._backoffMs(), 'error');
        break;
      default:
        if (this.health.consecutiveFailures >= 3) {
          this._activateCooldown(this._backoffMs(), 'consecutive_failures');
        }
    }

    this._updateStatus();
  }

  /**
   * Activate cooldown with exponential backoff.
   */
  _activateCooldown(durationMs, reason) {
    this.cooldown.active = true;
    this.cooldown.until = Date.now() + durationMs;
    this.cooldown.reason = reason;
    this.cooldown.retryCount++;
    this.status = CredentialStatus.COOLDOWN;
  }

  /**
   * Exponential backoff: 5s, 10s, 20s, 40s, max 5min.
   */
  _backoffMs() {
    const base = 5000;
    const max = 300000;
    return Math.min(base * Math.pow(2, this.cooldown.retryCount), max);
  }

  /**
   * Update status based on current state.
   */
  _updateStatus() {
    if (this.status === CredentialStatus.DISABLED || this.status === CredentialStatus.AUTH_INVALID) return;
    if (this.status === CredentialStatus.QUOTA_EXCEEDED) return;

    if (this.cooldown.active && Date.now() < this.cooldown.until) {
      this.status = CredentialStatus.COOLDOWN;
    } else if (this.quota.dailyUsed >= this.quota.dailyLimit) {
      this.status = CredentialStatus.QUOTA_EXCEEDED;
    } else if (!this.checkRateLimit()) {
      this.status = CredentialStatus.RATE_LIMITED;
    } else if (this.health.successRate < 0.5 && this.health.totalRequests > 5) {
      this.status = CredentialStatus.COOLDOWN;
      this._activateCooldown(30000, 'low_success_rate');
    } else {
      this.status = CredentialStatus.HEALTHY;
    }
  }

  /**
   * Get a score for routing (higher = better).
   */
  getScore() {
    if (!this.isAvailable()) return 0;

    let score = 100;

    // Success rate (0-40 points)
    score += (this.health.successRate - 0.5) * 80;

    // Latency (0-20 points, lower is better)
    if (this.health.avgLatencyMs > 0) {
      score += Math.max(0, 20 - (this.health.avgLatencyMs / 500));
    }

    // Quota headroom (0-20 points)
    const quotaRemaining = 1 - (this.quota.dailyUsed / this.quota.dailyLimit);
    score += quotaRemaining * 20;

    // Priority (0-10 points, lower priority number = better)
    score += (10 - this.priority) * 2;

    // Consecutive failures penalty
    score -= this.health.consecutiveFailures * 10;

    return Math.max(0, Math.round(score));
  }

  toJSON() {
    return {
      keyId: this.keyId,
      provider: this.provider,
      status: this.status,
      priority: this.priority,
      score: this.getScore(),
      available: this.isAvailable(),
      health: { ...this.health },
      quota: { ...this.quota },
      cooldown: { ...this.cooldown },
      rateLimit: {
        current: this.rateLimit.currentMinute,
        max: this.rateLimit.maxPerMinute,
      },
      recentErrors: this.errors.slice(-5),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// CREDENTIAL INTELLIGENCE — Central manager
// ═══════════════════════════════════════════════════════════════

class CredentialIntelligence {
  constructor() {
    this.credentials = new Map(); // `${provider}:${keyId}` → CredentialState
    this.providerKeys = new Map(); // provider → Set<keyId>
  }

  /**
   * Register a credential.
   */
  registerCredential(provider, keyId, config = {}) {
    const state = new CredentialState({ ...config, keyId, provider });
    const compositeKey = `${provider}:${keyId}`;
    this.credentials.set(compositeKey, state);

    if (!this.providerKeys.has(provider)) {
      this.providerKeys.set(provider, new Set());
    }
    this.providerKeys.get(provider).add(keyId);

    logger.event('CREDENTIAL_REGISTERED', { provider, keyId });
    return state;
  }

  /**
   * Get best credential for a provider.
   */
  getBestCredential(provider) {
    const keyIds = this.providerKeys.get(provider);
    if (!keyIds || keyIds.size === 0) return null;

    let best = null;
    let bestScore = -1;

    for (const keyId of keyIds) {
      const state = this.credentials.get(`${provider}:${keyId}`);
      if (!state || !state.isAvailable()) continue;

      const score = state.getScore();
      if (score > bestScore) {
        bestScore = score;
        best = state;
      }
    }

    return best;
  }

  /**
   * Get all available credentials for a provider, sorted by score.
   */
  getAvailableCredentials(provider) {
    const keyIds = this.providerKeys.get(provider);
    if (!keyIds) return [];

    const available = [];
    for (const keyId of keyIds) {
      const state = this.credentials.get(`${provider}:${keyId}`);
      if (state && state.isAvailable()) {
        available.push(state);
      }
    }

    return available.sort((a, b) => b.getScore() - a.getScore());
  }

  /**
   * Get the best provider + credential combination.
   */
  getBestProviderCredential(providers) {
    let best = null;
    let bestScore = -1;

    for (const provider of providers) {
      const cred = this.getBestCredential(provider);
      if (!cred) continue;

      const score = cred.getScore();
      if (score > bestScore) {
        bestScore = score;
        best = { provider, credential: cred, score };
      }
    }

    return best;
  }

  /**
   * Check if a provider has ANY available credential.
   */
  providerHasAvailableCredential(provider) {
    return this.getBestCredential(provider) !== null;
  }

  /**
   * Record success.
   */
  recordSuccess(provider, keyId, latencyMs, inputTokens = 0, outputTokens = 0) {
    const state = this.credentials.get(`${provider}:${keyId}`);
    if (state) state.recordSuccess(latencyMs, inputTokens, outputTokens);
  }

  /**
   * Record failure.
   */
  recordFailure(provider, keyId, error, category = 'unknown') {
    const state = this.credentials.get(`${provider}:${keyId}`);
    if (state) state.recordFailure(error, category);
  }

  /**
   * Get status for all credentials of a provider.
   */
  getProviderStatus(provider) {
    const keyIds = this.providerKeys.get(provider);
    if (!keyIds) return { provider, keys: [], availableCount: 0, totalCount: 0 };

    const keys = [];
    let availableCount = 0;
    for (const keyId of keyIds) {
      const state = this.credentials.get(`${provider}:${keyId}`);
      if (state) {
        keys.push(state.toJSON());
        if (state.isAvailable()) availableCount++;
      }
    }

    return { provider, keys, availableCount, totalCount: keys.length };
  }

  /**
   * Get global status.
   */
  getStatus() {
    const providers = {};
    for (const [provider] of this.providerKeys) {
      providers[provider] = this.getProviderStatus(provider);
    }

    let totalKeys = 0;
    let availableKeys = 0;
    for (const [, state] of this.credentials) {
      totalKeys++;
      if (state.isAvailable()) availableKeys++;
    }

    return {
      totalProviders: this.providerKeys.size,
      totalKeys,
      availableKeys,
      providers,
    };
  }

  /**
   * Get credential by composite key.
   */
  getCredential(provider, keyId) {
    return this.credentials.get(`${provider}:${keyId}`) || null;
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const credentialIntelligence = new CredentialIntelligence();

module.exports = {
  CredentialIntelligence,
  CredentialState,
  CredentialStatus,
  credentialIntelligence,
};
