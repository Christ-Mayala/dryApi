/**
 * Quota Engine — Suivi centralisé des quotas par provider/key/model/user.
 *
 * Suit :
 *   - requestCount (par minute, jour, mois)
 *   - tokenCount (par minute, jour, mois)
 *   - estimatedCost (par jour, mois)
 *
 * Le router utilise ces données pour éviter automatiquement
 * les ressources proches de leur limite.
 */

const { logger } = require('./inferenceLogger');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

/**
 * @typedef {Object} QuotaWindow
 * @property {number} requests - Nombre de requêtes
 * @property {number} tokens - Nombre de tokens
 * @property {number} estimatedCost - Coût estimé en USD
 * @property {number} windowStart - Timestamp du début de fenêtre
 */

/**
 * @typedef {Object} QuotaEntry
 * @property {QuotaWindow} minute - Fenêtre glissante 1 min
 * @property {QuotaWindow} day - Fenêtre glissante 24h
 * @property {QuotaWindow} month - Fenêtre glissante 30j
 * @property {Object} limits - Limites configurées
 */

class QuotaEngine {
  constructor() {
    // Map<"provider:modelId:keyId", QuotaEntry>
    this.quotas = new Map();
    // Map<"provider", QuotaEntry> - agrégé par provider
    this.providerQuotas = new Map();
    // Map<"userId", QuotaEntry> - agrégé par user
    this.userQuotas = new Map();

    this.decayInterval = setInterval(() => this._decay(), HOUR);
  }

  /**
   * Get or create quota entry for a specific key.
   */
  _getQuota(key) {
    if (!this.quotas.has(key)) {
      this.quotas.set(key, this._createEntry());
    }
    return this.quotas.get(key);
  }

  _getProviderQuota(provider) {
    if (!this.providerQuotas.has(provider)) {
      this.providerQuotas.set(provider, this._createEntry());
    }
    return this.providerQuotas.get(provider);
  }

  _getUserQuota(userId) {
    const key = String(userId);
    if (!this.userQuotas.has(key)) {
      this.userQuotas.set(key, this._createEntry());
    }
    return this.userQuotas.get(key);
  }

  _createEntry() {
    const now = Date.now();
    return {
      minute: { requests: 0, tokens: 0, estimatedCost: 0, windowStart: now },
      day: { requests: 0, tokens: 0, estimatedCost: 0, windowStart: now },
      month: { requests: 0, tokens: 0, estimatedCost: 0, windowStart: now },
      limits: {
        requestsPerDay: null,
        tokensPerDay: null,
        costPerDay: null,
        requestsPerMonth: null,
        tokensPerMonth: null,
        costPerMonth: null,
      },
    };
  }

  /**
   * Record a completed request.
   *
   * @param {string} provider
   * @param {string} modelId
   * @param {string} keyId
   * @param {string|ObjectId} userId
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {number} [estimatedCost=0] - Cost in USD
   */
  recordRequest(provider, modelId, keyId, userId, inputTokens, outputTokens, estimatedCost = 0) {
    const totalTokens = inputTokens + outputTokens;
    const now = Date.now();

    // Record at key level
    const keyQuota = this._getQuota(`${provider}:${modelId}:${keyId}`);
    this._incrementWindow(keyQuota.minute, totalTokens, estimatedCost, now, MINUTE);
    this._incrementWindow(keyQuota.day, totalTokens, estimatedCost, now, DAY);
    this._incrementWindow(keyQuota.month, totalTokens, estimatedCost, now, MONTH);

    // Record at provider level
    const providerQuota = this._getProviderQuota(provider);
    this._incrementWindow(providerQuota.minute, totalTokens, estimatedCost, now, MINUTE);
    this._incrementWindow(providerQuota.day, totalTokens, estimatedCost, now, DAY);
    this._incrementWindow(providerQuota.month, totalTokens, estimatedCost, now, MONTH);

    // Record at user level
    if (userId) {
      const userQuota = this._getUserQuota(userId);
      this._incrementWindow(userQuota.minute, totalTokens, estimatedCost, now, MINUTE);
      this._incrementWindow(userQuota.day, totalTokens, estimatedCost, now, DAY);
      this._incrementWindow(userQuota.month, totalTokens, estimatedCost, now, MONTH);
    }
  }

  /**
   * Increment a window, resetting if expired.
   */
  _incrementWindow(window, tokens, cost, now, windowMs) {
    if (now - window.windowStart > windowMs) {
      // Reset window
      window.requests = 0;
      window.tokens = 0;
      window.estimatedCost = 0;
      window.windowStart = now;
    }
    window.requests++;
    window.tokens += tokens;
    window.estimatedCost += cost;
  }

  /**
   * Check if a request would exceed quotas.
   *
   * @param {string} provider
   * @param {string} modelId
   * @param {string} keyId
   * @param {string|ObjectId} userId
   * @param {number} estimatedTokens
   * @returns {{ allowed: boolean, reason: string|null, details: object }}
   */
  checkQuota(provider, modelId, keyId, userId, estimatedTokens) {
    const now = Date.now();

    // Check key-level quotas
    const keyQuota = this._getQuota(`${provider}:${modelId}:${keyId}`);
    if (keyQuota.limits.requestsPerDay && keyQuota.day.requests >= keyQuota.limits.requestsPerDay) {
      return { allowed: false, reason: 'Key daily request limit reached', level: 'key' };
    }
    if (keyQuota.limits.tokensPerDay && keyQuota.day.tokens + estimatedTokens > keyQuota.limits.tokensPerDay) {
      return { allowed: false, reason: 'Key daily token limit reached', level: 'key' };
    }
    if (keyQuota.limits.costPerDay && keyQuota.day.estimatedCost >= keyQuota.limits.costPerDay) {
      return { allowed: false, reason: 'Key daily cost limit reached', level: 'key' };
    }

    // Check provider-level quotas
    const providerQuota = this._getProviderQuota(provider);
    if (providerQuota.limits.requestsPerDay && providerQuota.day.requests >= providerQuota.limits.requestsPerDay) {
      return { allowed: false, reason: 'Provider daily request limit reached', level: 'provider' };
    }

    // Check user-level quotas
    if (userId) {
      const userQuota = this._getUserQuota(userId);
      if (userQuota.limits.requestsPerDay && userQuota.day.requests >= userQuota.limits.requestsPerDay) {
        return { allowed: false, reason: 'User daily request limit reached', level: 'user' };
      }
      if (userQuota.limits.tokensPerDay && userQuota.day.tokens + estimatedTokens > userQuota.limits.tokensPerDay) {
        return { allowed: false, reason: 'User daily token limit reached', level: 'user' };
      }
    }

    return { allowed: true, reason: null, details: {} };
  }

  /**
   * Set limits for a key/provider/user.
   */
  setLimits(target, limits) {
    if (target.type === 'key') {
      const entry = this._getQuota(`${target.provider}:${target.modelId}:${target.keyId}`);
      Object.assign(entry.limits, limits);
    } else if (target.type === 'provider') {
      const entry = this._getProviderQuota(target.provider);
      Object.assign(entry.limits, limits);
    } else if (target.type === 'user') {
      const entry = this._getUserQuota(target.userId);
      Object.assign(entry.limits, limits);
    }
  }

  /**
   * Get current usage for a specific entity.
   */
  getUsage(provider, modelId, keyId) {
    const key = `${provider}:${modelId}:${keyId}`;
    const entry = this._getQuota(key);
    return {
      minute: { ...entry.minute },
      day: { ...entry.day },
      month: { ...entry.month },
    };
  }

  /**
   * Get all provider-level quotas (for dashboard).
   */
  getAllProviderQuotas() {
    const result = [];
    for (const [provider, entry] of this.providerQuotas) {
      result.push({
        provider,
        minute: { ...entry.minute },
        day: { ...entry.day },
        month: { ...entry.month },
      });
    }
    return result.sort((a, b) => b.day.requests - a.day.requests);
  }

  /**
   * Decay old data.
   */
  _decay() {
    const now = Date.now();
    for (const [key, entry] of this.quotas) {
      if (now - entry.month.windowStart > MONTH * 2) {
        this.quotas.delete(key);
      }
    }
  }

  /**
   * Cleanup.
   */
  destroy() {
    if (this.decayInterval) clearInterval(this.decayInterval);
  }
}

// Singleton
const quotaEngine = new QuotaEngine();

module.exports = {
  QuotaEngine,
  quotaEngine,
};
