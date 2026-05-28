const performanceStore = new Map();
const METRICS_TTL_MS = 3600000; // 1 heure

function getKey(platform, modelId) {
  return `${platform}:${modelId}`;
}

function getMetrics(platform, modelId) {
  const key = getKey(platform, modelId);
  const now = Date.now();
  let metrics = performanceStore.get(key);
  
  if (!metrics) {
    metrics = {
      platform,
      modelId,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      lastUpdated: now,
      latencyHistory: []
    };
    performanceStore.set(key, metrics);
  }
  
  // Nettoyer l'historique vieux
  metrics.latencyHistory = metrics.latencyHistory.filter(l => now - l.timestamp < METRICS_TTL_MS);
  
  return metrics;
}

function recordSuccess(platform, modelId, latencyMs, inputTokens, outputTokens) {
  const metrics = getMetrics(platform, modelId);
  metrics.totalRequests++;
  metrics.successCount++;
  metrics.totalLatencyMs += latencyMs;
  metrics.totalInputTokens += inputTokens;
  metrics.totalOutputTokens += outputTokens;
  metrics.lastUpdated = Date.now();
  
  metrics.latencyHistory.push({ timestamp: Date.now(), latencyMs });
  if (metrics.latencyHistory.length > 100) {
    metrics.latencyHistory.shift();
  }
}

function recordFailure(platform, modelId) {
  const metrics = getMetrics(platform, modelId);
  metrics.totalRequests++;
  metrics.failureCount++;
  metrics.lastUpdated = Date.now();
}

function getSuccessRate(platform, modelId) {
  const metrics = getMetrics(platform, modelId);
  if (metrics.totalRequests === 0) return 1;
  return metrics.successCount / metrics.totalRequests;
}

function getAvgLatency(platform, modelId) {
  const metrics = getMetrics(platform, modelId);
  if (metrics.successCount === 0) return Infinity;
  return metrics.totalLatencyMs / metrics.successCount;
}

function getP95Latency(platform, modelId) {
  const metrics = getMetrics(platform, modelId);
  if (metrics.latencyHistory.length === 0) return Infinity;
  const sorted = [...metrics.latencyHistory].sort((a, b) => a.latencyMs - b.latencyMs);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.max(0, idx - 1)]?.latencyMs || Infinity;
}

function getAllMetrics() {
  const result = [];
  const now = Date.now();
  for (const [key, metrics] of performanceStore.entries()) {
    if (now - metrics.lastUpdated < METRICS_TTL_MS) {
      result.push({
        ...metrics,
        successRate: getSuccessRate(metrics.platform, metrics.modelId),
        avgLatencyMs: getAvgLatency(metrics.platform, metrics.modelId),
        p95LatencyMs: getP95Latency(metrics.platform, metrics.modelId)
      });
    }
  }
  return result;
}

module.exports = {
  getMetrics,
  recordSuccess,
  recordFailure,
  getSuccessRate,
  getAvgLatency,
  getP95Latency,
  getAllMetrics
};
