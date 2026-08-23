/**
 * Request Attempt Registry — Suit chaque tentative par requête.
 *
 * Problème résolu : ne JAMAIS faire A → A → A → A
 * si A est déjà identifié comme indisponible.
 *
 * Chaque requête reçoit un requestId unique.
 * Chaque tentative est enregistrée avec :
 *   - provider
 *   - keyId
 *   - model
 *   - résultat (success / error)
 *   - catégorie d'erreur
 *   - latence
 *
 * Le router consulte le registry AVANT de choisir le prochain provider.
 */

const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// ATTEMPT STATUS
// ═══════════════════════════════════════════════════════════════

const AttemptStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  IN_PROGRESS: 'in_progress',
};

// ═══════════════════════════════════════════════════════════════
// REQUEST ATTEMPTS — All attempts for one request
// ═══════════════════════════════════════════════════════════════

class RequestAttempts {
  constructor(requestId) {
    this.requestId = requestId;
    this.attempts = [];
    this.startTime = Date.now();
    this.triedProviders = new Set();    // provider → tried
    this.triedKeys = new Set();         // provider:keyId → tried
    this.triedModels = new Set();       // model → tried
    this.failedProviders = new Set();   // provider → failed
    this.failedKeys = new Set();        // provider:keyId → failed
  }

  /**
   * Record the start of an attempt.
   */
  startAttempt(provider, keyId, model) {
    const attempt = {
      provider,
      keyId,
      model,
      status: AttemptStatus.IN_PROGRESS,
      startTime: Date.now(),
      endTime: null,
      latencyMs: null,
      error: null,
      errorCategory: null,
    };

    this.attempts.push(attempt);
    this.triedProviders.add(provider);
    this.triedKeys.add(`${provider}:${keyId}`);
    if (model) this.triedModels.add(model);

    return this.attempts.length - 1; // return index
  }

  /**
   * Record the end of an attempt (success).
   */
  endAttemptSuccess(index, latencyMs, result = null) {
    const attempt = this.attempts[index];
    if (!attempt) return;

    attempt.status = AttemptStatus.SUCCESS;
    attempt.endTime = Date.now();
    attempt.latencyMs = latencyMs;
    attempt.result = result;
  }

  /**
   * Record the end of an attempt (failure).
   */
  endAttemptFailure(index, latencyMs, error, errorCategory = 'unknown') {
    const attempt = this.attempts[index];
    if (!attempt) return;

    attempt.status = AttemptStatus.FAILED;
    attempt.endTime = Date.now();
    attempt.latencyMs = latencyMs;
    attempt.error = String(error).slice(0, 500);
    attempt.errorCategory = errorCategory;

    this.failedProviders.add(attempt.provider);
    this.failedKeys.add(`${attempt.provider}:${attempt.keyId}`);
  }

  /**
   * Check if a provider has been tried.
   */
  hasTriedProvider(provider) {
    return this.triedProviders.has(provider);
  }

  /**
   * Check if a specific key has been tried.
   */
  hasTriedKey(provider, keyId) {
    return this.triedKeys.has(`${provider}:${keyId}`);
  }

  /**
   * Check if a model has been tried.
   */
  hasTriedModel(model) {
    return this.triedModels.has(model);
  }

  /**
   * Check if a provider has FAILED (not just tried).
   */
  hasFailedProvider(provider) {
    return this.failedProviders.has(provider);
  }

  /**
   * Check if a key has FAILED.
   */
  hasFailedKey(provider, keyId) {
    return this.failedKeys.has(`${provider}:${keyId}`);
  }

  /**
   * Get providers that should be skipped (failed).
   */
  getFailedProviders() {
    return Array.from(this.failedProviders);
  }

  /**
   * Get all failed keys.
   */
  getFailedKeys() {
    return Array.from(this.failedKeys);
  }

  /**
   * Check if a provider+key+model combo should be retried.
   */
  shouldSkip(provider, keyId, model) {
    // Never retry a failed key
    if (this.failedKeys.has(`${provider}:${keyId}`)) return true;
    // Never retry same model on same provider
    if (model && this.hasTriedModel(model) && this.hasTriedProvider(provider)) return true;
    return false;
  }

  /**
   * Get summary of all attempts.
   */
  getSummary() {
    const totalTime = Date.now() - this.startTime;
    const successAttempt = this.attempts.find(a => a.status === AttemptStatus.SUCCESS);

    return {
      requestId: this.requestId,
      totalAttempts: this.attempts.length,
      successful: !!successAttempt,
      successProvider: successAttempt?.provider || null,
      successModel: successAttempt?.model || null,
      triedProviders: Array.from(this.triedProviders),
      triedKeys: Array.from(this.triedKeys),
      failedProviders: Array.from(this.failedProviders),
      failedKeys: Array.from(this.failedKeys),
      totalTimeMs: totalTime,
      attempts: this.attempts.map(a => ({
        provider: a.provider,
        keyId: a.keyId,
        model: a.model,
        status: a.status,
        latencyMs: a.latencyMs,
        errorCategory: a.errorCategory,
      })),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// REQUEST ATTEMPT REGISTRY — Central registry
// ═══════════════════════════════════════════════════════════════

class RequestAttemptRegistry {
  constructor() {
    this.requests = new Map(); // requestId → RequestAttempts
    this.maxEntries = 5000;
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * Create a new request attempt tracker.
   */
  createRequest(requestId) {
    const attempts = new RequestAttempts(requestId);
    this.requests.set(requestId, attempts);

    // Cleanup old entries if needed
    if (this.requests.size > this.maxEntries) {
      this._cleanup();
    }

    return attempts;
  }

  /**
   * Get attempts for a request.
   */
  getRequest(requestId) {
    return this.requests.get(requestId) || null;
  }

  /**
   * Delete a request entry.
   */
  deleteRequest(requestId) {
    this.requests.delete(requestId);
  }

  /**
   * Get stats.
   */
  getStats() {
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalAttempts = 0;
    let totalRetries = 0;

    for (const [, attempts] of this.requests) {
      totalRequests++;
      const summary = attempts.getSummary();
      if (summary.successful) successfulRequests++;
      totalAttempts += summary.totalAttempts;
      totalRetries += Math.max(0, summary.totalAttempts - 1);
    }

    return {
      activeRequests: this.requests.size,
      totalRequests,
      successfulRequests,
      successRate: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) + '%' : 'N/A',
      totalAttempts,
      totalRetries,
      avgAttemptsPerRequest: totalRequests > 0 ? (totalAttempts / totalRequests).toFixed(1) : 0,
    };
  }

  /**
   * Cleanup old entries.
   */
  _cleanup() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [requestId, attempts] of this.requests) {
      if (now - attempts.startTime > maxAge) {
        this.requests.delete(requestId);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const requestAttemptRegistry = new RequestAttemptRegistry();

module.exports = {
  RequestAttemptRegistry,
  RequestAttempts,
  AttemptStatus,
  requestAttemptRegistry,
};
