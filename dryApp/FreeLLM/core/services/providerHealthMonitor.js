/**
 * Provider Health Monitor — Suivi continu de la santé de chaque provider.
 *
 * Fournit au router des données fiables sur :
 * - Disponibilité (success rate)
 * - Latence (avg, p95, p99)
 * - Taux d'erreur
 * - Quota restant (si disponible)
 * - Statut rate-limit
 * - Tendance (improving / stable / degrading)
 *
 * Alimenté par les résultats des requêtes passées (via recordSuccess/recordFailure).
 * Utilisé par le router pour le scoring et le routing adaptatif.
 */

const { logger } = require('./inferenceLogger');

const HEALTH_DECAY_INTERVAL_MS = 5 * 60 * 1000; // decay every 5 minutes
const MAX_LATENCY_HISTORY = 200;
const MAX_ERROR_HISTORY = 50;

/**
 * @typedef {Object} ProviderHealth
 * @property {string} provider
 * @property {number} totalRequests
 * @property {number} successCount
 * @property {number} failureCount
 * @property {number} successRate
 * @property {number} avgLatencyMs
 * @property {number} p95LatencyMs
 * @property {number} p99LatencyMs
 * @property {number} errorRate
 * @property {string} trend - 'improving' | 'stable' | 'degrading'
 * @property {boolean} isRateLimited
 * @property {number|null} rateLimitedUntil
 * @property {number} lastSuccessAt
 * @property {number} lastFailureAt
 * @property {number} lastUpdatedAt
 */

class ProviderHealthMonitor {
  constructor() {
    this.health = new Map(); // Map<provider, ProviderHealth>
    this.lastDecay = Date.now();
  }

  /**
   * Get or create health entry for a provider.
   */
  _getHealth(provider) {
    if (!this.health.has(provider)) {
      this.health.set(provider, {
        provider,
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 1.0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        errorRate: 0,
        trend: 'stable',
        isRateLimited: false,
        rateLimitedUntil: null,
        lastSuccessAt: 0,
        lastFailureAt: 0,
        lastUpdatedAt: Date.now(),
        latencyHistory: [],
        errorHistory: [],
        recentSuccessWindow: [],
        recentFailureWindow: [],
      });
    }
    return this.health.get(provider);
  }

  /**
   * Record a successful request.
   */
  recordSuccess(provider, latencyMs, inputTokens = 0, outputTokens = 0) {
    const h = this._getHealth(provider);
    const now = Date.now();

    h.totalRequests++;
    h.successCount++;
    h.lastSuccessAt = now;
    h.lastUpdatedAt = now;

    // Latency tracking
    h.latencyHistory.push({ timestamp: now, latencyMs });
    if (h.latencyHistory.length > MAX_LATENCY_HISTORY) {
      h.latencyHistory.shift();
    }

    // Window for trend detection (last 20 requests)
    h.recentSuccessWindow.push(now);
    if (h.recentSuccessWindow.length > 20) h.recentSuccessWindow.shift();

    // Recalculate metrics
    this._recalculateMetrics(h);

    // Clear rate limit if we got a success
    if (h.isRateLimited) {
      h.isRateLimited = false;
      h.rateLimitedUntil = null;
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(provider, errorMessage = '', latencyMs = 0) {
    const h = this._getHealth(provider);
    const now = Date.now();

    h.totalRequests++;
    h.failureCount++;
    h.lastFailureAt = now;
    h.lastUpdatedAt = now;

    // Error history
    h.errorHistory.push({ timestamp: now, message: errorMessage.slice(0, 200) });
    if (h.errorHistory.length > MAX_ERROR_HISTORY) {
      h.errorHistory.shift();
    }

    // Window for trend detection
    h.recentFailureWindow.push(now);
    if (h.recentFailureWindow.length > 20) h.recentFailureWindow.shift();

    // Latency tracking (even for failures)
    if (latencyMs > 0) {
      h.latencyHistory.push({ timestamp: now, latencyMs });
      if (h.latencyHistory.length > MAX_LATENCY_HISTORY) {
        h.latencyHistory.shift();
      }
    }

    // Recalculate metrics
    this._recalculateMetrics(h);

    // Detect rate limiting
    const lowerMsg = errorMessage.toLowerCase();
    if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('quota')) {
      h.isRateLimited = true;
      // Try to extract retry-after
      const match = errorMessage.match(/retry after (\d+)/i);
      const retryAfterMs = match ? parseInt(match[1]) * 1000 : 60_000;
      h.rateLimitedUntil = now + retryAfterMs;
    }
  }

  /**
   * Recalculate derived metrics.
   */
  _recalculateMetrics(h) {
    const now = Date.now();

    // Success rate
    h.successRate = h.totalRequests > 0 ? h.successCount / h.totalRequests : 1.0;
    h.errorRate = h.totalRequests > 0 ? h.failureCount / h.totalRequests : 0;

    // Latency percentiles
    if (h.latencyHistory.length > 0) {
      const latencies = h.latencyHistory.map(l => l.latencyMs).sort((a, b) => a - b);
      h.avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      h.p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || h.avgLatencyMs;
      h.p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] || h.avgLatencyMs;
    }

    // Trend detection: compare recent success rate vs overall
    if (h.recentSuccessWindow.length >= 10 && h.recentFailureWindow.length >= 5) {
      const recentSuccessRate = h.recentSuccessWindow.length /
        (h.recentSuccessWindow.length + h.recentFailureWindow.length);
      if (recentSuccessRate > h.successRate + 0.1) {
        h.trend = 'improving';
      } else if (recentSuccessRate < h.successRate - 0.1) {
        h.trend = 'degrading';
      } else {
        h.trend = 'stable';
      }
    }

    // Check rate limit expiry
    if (h.isRateLimited && h.rateLimitedUntil && now > h.rateLimitedUntil) {
      h.isRateLimited = false;
      h.rateLimitedUntil = null;
    }
  }

  /**
   * Decay old metrics to prevent stale data from dominating.
   */
  decay() {
    const now = Date.now();
    if (now - this.lastDecay < HEALTH_DECAY_INTERVAL_MS) return;
    this.lastDecay = now;

    for (const [provider, h] of this.health) {
      // Remove latency entries older than 1 hour
      h.latencyHistory = h.latencyHistory.filter(l => now - l.timestamp < 3600_000);
      h.errorHistory = h.errorHistory.filter(e => now - e.timestamp < 3600_000);

      // Recalculate after cleanup
      this._recalculateMetrics(h);
    }
  }

  /**
   * Get health for a specific provider.
   */
  getHealth(provider) {
    this.decay();
    return this._getHealth(provider);
  }

  /**
   * Get all provider health (for dashboard).
   */
  getAllHealth() {
    this.decay();
    const result = [];
    for (const [, h] of this.health) {
      // Remove internal fields
      const { latencyHistory, errorHistory, recentSuccessWindow, recentFailureWindow, ...clean } = h;
      result.push(clean);
    }
    return result.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Calculate a health score (0-100) for routing decisions.
   */
  getHealthScore(provider) {
    const h = this._getHealth(provider);

    // Base: success rate (0-50 points)
    let score = h.successRate * 50;

    // Latency score (0-30 points, lower is better)
    if (h.avgLatencyMs > 0) {
      // 100ms → 30 points, 10s → 0 points
      const latencyScore = Math.max(0, 30 * (1 - h.avgLatencyMs / 10000));
      score += latencyScore;
    } else {
      score += 15; // no data = neutral
    }

    // Trend bonus/penalty (±10 points)
    if (h.trend === 'improving') score += 10;
    else if (h.trend === 'degrading') score -= 10;

    // Rate limit penalty (-20 points)
    if (h.isRateLimited) score -= 20;

    // Error rate penalty
    score -= h.errorRate * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get recommended providers sorted by health score.
   */
  getRankedProviders() {
    const providers = Array.from(this.health.keys());
    return providers
      .map(p => ({ provider: p, score: this.getHealthScore(p), ...this._getHealth(p) }))
      .filter(p => !p.isRateLimited) // exclude rate-limited
      .sort((a, b) => b.score - a.score);
  }
}

// Singleton
const monitor = new ProviderHealthMonitor();

module.exports = {
  ProviderHealthMonitor,
  monitor,
};
