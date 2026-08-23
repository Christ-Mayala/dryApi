/**
 * Observability Service — Tracing, métriques structurées et dashboard data.
 *
 * Pour chaque requête, fournit :
 *   - requestId unique
 *   - Trace complète (auth → classify → route → provider → validate → respond)
 *   - Métriques par provider/model/task
 *   - Données pour le dashboard
 */

const { logger } = require('./inferenceLogger');

/**
 * @typedef {Object} RequestTrace
 * @property {string} requestId
 * @property {string} userId
 * @property {string} status - 'success' | 'error' | 'timeout' | 'fallback'
 * @property {string} provider
 * @property {string} modelId
 * @property {string} taskType
 * @property {boolean} stream
 * @property {boolean} cacheHit
 * @property {boolean} isIdeMode
 * @property {boolean} degradedMode
 * @property {string} errorCategory
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {number} latencyMs
 * @property {number} fallbackCount
 * @property {Array} fallbackHistory
 * @property {Array} steps - Timeline of processing steps
 * @property {object} policyDecisions
 * @property {Date} createdAt
 */

class ObservabilityService {
  constructor() {
    this.traces = new Map(); // requestId → RequestTrace
    this.completedTraces = []; // recent completed traces
    this.MAX_COMPLETED = 500;

    // Aggregate metrics
    this.metrics = {
      totalRequests: 0,
      totalSuccess: 0,
      totalErrors: 0,
      totalFallbacks: 0,
      totalCacheHits: 0,
      totalStreamRequests: 0,
      totalIdeRequests: 0,
      totalDegradedResponses: 0,
      totalTokensUsed: 0,
      totalLatencyMs: 0,
      providerRequests: new Map(),   // provider → count
      providerErrors: new Map(),     // provider → count
      taskTypeRequests: new Map(),   // taskType → count
      errorCategories: new Map(),    // category → count
      hourlyBuckets: new Map(),      // "YYYY-MM-DD-HH" → { requests, errors, tokens }
    };
  }

  /**
   * Start tracing a new request.
   */
  startTrace(requestId, metadata = {}) {
    const trace = {
      requestId,
      userId: metadata.userId || null,
      status: 'pending',
      provider: null,
      modelId: null,
      taskType: metadata.taskType || 'chat',
      stream: metadata.stream || false,
      cacheHit: false,
      isIdeMode: metadata.isIdeMode || false,
      degradedMode: metadata.degradedMode || false,
      errorCategory: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
      fallbackCount: 0,
      fallbackHistory: [],
      steps: [],
      policyDecisions: [],
      createdAt: new Date(),
    };

    this.traces.set(requestId, trace);
    this._addStep(trace, 'start', { taskType: trace.taskType, stream: trace.stream });
    return trace;
  }

  /**
   * Add a step to the trace timeline.
   */
  _addStep(trace, name, data = {}) {
    trace.steps.push({
      name,
      timestamp: Date.now(),
      durationMs: trace.steps.length > 0
        ? Date.now() - trace.steps[trace.steps.length - 1].timestamp
        : 0,
      data,
    });
  }

  /**
   * Record auth result.
   */
  recordAuth(requestId, success, userId) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.userId = userId;
    this._addStep(trace, 'auth', { success, userId: userId ? String(userId) : null });
  }

  /**
   * Record classification result.
   */
  recordClassification(requestId, taskType, confidence) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.taskType = taskType;
    this._addStep(trace, 'classify', { taskType, confidence });
  }

  /**
   * Record routing decision.
   */
  recordRouting(requestId, provider, modelId, score) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.provider = provider;
    trace.modelId = modelId;
    this._addStep(trace, 'route', { provider, modelId, score });
  }

  /**
   * Record fallback attempt.
   */
  recordFallback(requestId, fromProvider, toProvider, reason) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.fallbackCount++;
    trace.fallbackHistory.push({ from: fromProvider, to: toProvider, reason, timestamp: Date.now() });
    this._addStep(trace, 'fallback', { from: fromProvider, to: toProvider, reason });
  }

  /**
   * Record policy decision.
   */
  recordPolicyDecision(requestId, decisions) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.policyDecisions = decisions;
    this._addStep(trace, 'policy', { decisions: decisions.map(d => d.ruleName) });
  }

  /**
   * Record cache hit.
   */
  recordCacheHit(requestId) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.cacheHit = true;
    trace.status = 'success';
    this._addStep(trace, 'cache_hit');
    this._finalizeTrace(trace);
  }

  /**
   * Record success.
   */
  recordSuccess(requestId, inputTokens, outputTokens, latencyMs) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.status = 'success';
    trace.inputTokens = inputTokens;
    trace.outputTokens = outputTokens;
    trace.totalTokens = inputTokens + outputTokens;
    trace.latencyMs = latencyMs;
    this._addStep(trace, 'success', { tokens: trace.totalTokens, latencyMs });
    this._finalizeTrace(trace);
  }

  /**
   * Record error.
   */
  recordError(requestId, errorCategory, errorMessage, latencyMs) {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.status = 'error';
    trace.errorCategory = errorCategory;
    trace.latencyMs = latencyMs;
    this._addStep(trace, 'error', { category: errorCategory, message: errorMessage?.slice(0, 200) });
    this._finalizeTrace(trace);
  }

  /**
   * Finalize a trace and update aggregate metrics.
   */
  _finalizeTrace(trace) {
    this.metrics.totalRequests++;

    if (trace.status === 'success') this.metrics.totalSuccess++;
    else this.metrics.totalErrors++;

    if (trace.cacheHit) this.metrics.totalCacheHits++;
    if (trace.stream) this.metrics.totalStreamRequests++;
    if (trace.isIdeMode) this.metrics.totalIdeRequests++;
    if (trace.degradedMode) this.metrics.totalDegradedResponses++;
    if (trace.fallbackCount > 0) this.metrics.totalFallbacks += trace.fallbackCount;

    this.metrics.totalTokensUsed += trace.totalTokens;
    this.metrics.totalLatencyMs += trace.latencyMs;

    // Provider metrics
    if (trace.provider) {
      this.metrics.providerRequests.set(trace.provider, (this.metrics.providerRequests.get(trace.provider) || 0) + 1);
      if (trace.status === 'error') {
        this.metrics.providerErrors.set(trace.provider, (this.metrics.providerErrors.get(trace.provider) || 0) + 1);
      }
    }

    // Task type metrics
    this.metrics.taskTypeRequests.set(trace.taskType, (this.metrics.taskTypeRequests.get(trace.taskType) || 0) + 1);

    // Error categories
    if (trace.errorCategory) {
      this.metrics.errorCategories.set(trace.errorCategory, (this.metrics.errorCategories.get(trace.errorCategory) || 0) + 1);
    }

    // Hourly bucket
    const hour = trace.createdAt.toISOString().slice(0, 13); // "2024-01-15T14"
    if (!this.metrics.hourlyBuckets.has(hour)) {
      this.metrics.hourlyBuckets.set(hour, { requests: 0, errors: 0, tokens: 0 });
    }
    const bucket = this.metrics.hourlyBuckets.get(hour);
    bucket.requests++;
    if (trace.status === 'error') bucket.errors++;
    bucket.tokens += trace.totalTokens;

    // Move to completed
    this.completedTraces.push(trace);
    if (this.completedTraces.length > this.MAX_COMPLETED) {
      this.completedTraces.shift();
    }
  }

  /**
   * Get a specific trace.
   */
  getTrace(requestId) {
    return this.traces.get(requestId) || this.completedTraces.find(t => t.requestId === requestId);
  }

  /**
   * Get aggregate metrics (for dashboard).
   */
  getMetrics() {
    const avgLatency = this.metrics.totalRequests > 0
      ? Math.round(this.metrics.totalLatencyMs / this.metrics.totalRequests)
      : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      successRate: this.metrics.totalRequests > 0
        ? ((this.metrics.totalSuccess / this.metrics.totalRequests) * 100).toFixed(1) + '%'
        : '0%',
      errorRate: this.metrics.totalRequests > 0
        ? ((this.metrics.totalErrors / this.metrics.totalRequests) * 100).toFixed(1) + '%'
        : '0%',
      avgLatencyMs: avgLatency,
      totalTokensUsed: this.metrics.totalTokensUsed,
      totalFallbacks: this.metrics.totalFallbacks,
      cacheHitRate: this.metrics.totalRequests > 0
        ? ((this.metrics.totalCacheHits / this.metrics.totalRequests) * 100).toFixed(1) + '%'
        : '0%',
      streamRequests: this.metrics.totalStreamRequests,
      ideRequests: this.metrics.totalIdeRequests,
      degradedResponses: this.metrics.totalDegradedResponses,
      byProvider: Object.fromEntries(
        Array.from(this.metrics.providerRequests.entries()).map(([p, count]) => [
          p,
          { requests: count, errors: this.metrics.providerErrors.get(p) || 0,
            errorRate: ((this.metrics.providerErrors.get(p) || 0) / count * 100).toFixed(1) + '%' }
        ])
      ),
      byTaskType: Object.fromEntries(this.metrics.taskTypeRequests),
      errorCategories: Object.fromEntries(this.metrics.errorCategories),
      hourly: Object.fromEntries(this.metrics.hourlyBuckets),
    };
  }

  /**
   * Get recent traces (for dashboard).
   */
  getRecentTraces(limit = 50) {
    return this.completedTraces.slice(-limit).reverse();
  }

  /**
   * Get traces for a specific provider.
   */
  getTracesByProvider(provider, limit = 50) {
    return this.completedTraces
      .filter(t => t.provider === provider)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get slow requests (for debugging).
   */
  getSlowRequests(thresholdMs = 5000, limit = 20) {
    return this.completedTraces
      .filter(t => t.latencyMs > thresholdMs)
      .slice(-limit)
      .reverse();
  }
}

// Singleton
const observability = new ObservabilityService();

module.exports = {
  ObservabilityService,
  observability,
};
