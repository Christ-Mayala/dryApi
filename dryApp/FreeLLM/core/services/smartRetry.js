/**
 * Smart Retry Engine — Retry intelligent basé sur la classification des erreurs.
 *
 * Remplace la logique de retry ad-hoc dans inferenceOsProxy.js.
 *
 * Caractéristiques :
 * - Backoff exponentiel avec jitter
 * - Budget de retry configurable
 * - Décisions basées sur la catégorie d'erreur (errorClassifier)
 * - Pas de retry pour les erreurs non-retryable (auth, content policy)
 * - Délai adaptatif basé sur le Retry-After du provider
 */

const { classifyError, ErrorCategory } = require('./errorClassifier');
const { logger } = require('./inferenceLogger');

/**
 * @typedef {Object} RetryConfig
 * @property {number} maxRetries - Nombre maximum de retries au total
 * @property {number} maxNetworkRetries - Retries réseau sur le même provider
 * @property {number} baseDelayMs - Délai de base en ms
 * @property {number} maxDelayMs - Délai maximum en ms
 * @property {number} jitterFactor - Facteur de jitter (0-1)
 */

const DEFAULT_CONFIG = {
  maxRetries: 4,         // 4 fallbacks max
  maxNetworkRetries: 2,  // 2 retries réseau sur même provider
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  jitterFactor: 0.3,
};

/**
 * Retry state for a single request.
 */
class RetryState {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.totalAttempts = 0;
    this.networkRetries = 0;
    this.fallbackCount = 0;
    this.errors = []; // history of classified errors
    this.startTime = Date.now();
  }

  /**
   * Register an attempt result.
   * Returns a decision: what to do next.
   *
   * @param {Error|string} error - The error that occurred
   * @param {string} provider - Provider name
   * @param {string} keyId - Key ID
   * @returns {{ action: string, delayMs: number, classifiedError: object }}
   */
  recordAttempt(error, provider = 'unknown', keyId = null) {
    this.totalAttempts++;
    const classified = classifyError(error, provider);
    classified.keyId = keyId;
    this.errors.push(classified);

    // Network error: retry same provider if budget allows
    if (classified.category === ErrorCategory.NETWORK_ERROR ||
        classified.category === ErrorCategory.TIMEOUT) {
      if (this.networkRetries < this.config.maxNetworkRetries) {
        this.networkRetries++;
        const delay = this.calculateDelay(classified);
        return {
          action: 'retry_same_provider',
          delayMs: delay,
          classifiedError: classified,
        };
      }
    }

    // Non-retryable: stop immediately
    if (!classified.retryable) {
      return {
        action: 'fail',
        delayMs: 0,
        classifiedError: classified,
      };
    }

    // Retryable but should skip to next key/provider
    if (classified.skipToNextKey) {
      if (this.fallbackCount < this.config.maxRetries) {
        this.fallbackCount++;
        this.networkRetries = 0; // reset on key change
        const delay = this.calculateDelay(classified);
        return {
          action: 'fallback',
          delayMs: delay,
          classifiedError: classified,
        };
      }
      // Fallback budget exhausted but error wants new key → fail
      return {
        action: 'fail',
        delayMs: 0,
        classifiedError: classified,
      };
    }

    // Retryable, same provider
    if (this.networkRetries < this.config.maxNetworkRetries) {
      this.networkRetries++;
      const delay = this.calculateDelay(classified);
      return {
        action: 'retry_same_provider',
        delayMs: delay,
        classifiedError: classified,
      };
    }

    // Budget exhausted
    return {
      action: 'fail',
      delayMs: this.calculateDelay(classified),
      classifiedError: classified,
    };
  }

  /**
   * Calculate delay with exponential backoff + jitter.
   */
  calculateDelay(classified) {
    // If provider gave us a Retry-After, use it
    if (classified.retryAfterMs) {
      return Math.min(classified.retryAfterMs, this.config.maxDelayMs);
    }

    // Exponential backoff: base * 2^attempt
    const exponential = this.config.baseDelayMs * Math.pow(2, this.totalAttempts - 1);

    // Add jitter
    const jitter = exponential * this.config.jitterFactor * Math.random();
    const delay = exponential + jitter;

    return Math.min(Math.round(delay), this.config.maxDelayMs);
  }

  /**
   * Check if we should continue retrying.
   */
  shouldContinue() {
    // Total attempts budget
    if (this.totalAttempts >= this.config.maxRetries + this.config.maxNetworkRetries + 1) {
      return false;
    }

    // Fallback budget exhausted
    if (this.fallbackCount >= this.config.maxRetries) {
      return false;
    }

    // Check if last error was non-retryable
    if (this.errors.length > 0) {
      const lastError = this.errors[this.errors.length - 1];
      if (!lastError.retryable) return false;
    }

    return true;
  }

  /**
   * Get summary of retry state.
   */
  getSummary() {
    return {
      totalAttempts: this.totalAttempts,
      networkRetries: this.networkRetries,
      fallbackCount: this.fallbackCount,
      elapsedMs: Date.now() - this.startTime,
      errors: this.errors.map(e => ({
        category: e.category,
        provider: e.provider,
        httpCode: e.httpCode,
      })),
    };
  }

  /**
   * Get all blacklisted keys (keys that should be skipped).
   */
  getBlacklistedKeys() {
    return this.errors
      .filter(e => e.blacklistKey)
      .map(e => e.keyId)
      .filter(Boolean);
  }
}

/**
 * Wait for a specified duration (used between retries).
 */
function wait(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  RetryState,
  wait,
  DEFAULT_CONFIG,
};
