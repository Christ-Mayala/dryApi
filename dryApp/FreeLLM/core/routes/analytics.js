const express = require('express');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;
const { getAllCircuitBreakers } = require('../services/circuitBreaker.js');
const { getAllMetrics } = require('../services/performanceMetrics.js');
const { getStats: getCacheStats } = require('../services/responseCache.js');
const router = express.Router();

function getSinceTimestamp(range) {
  const now = Date.now();
  switch (range) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '7d':
    default:
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }
}

function createAnalyticsRouter(ModelsModel, RequestsModel) {
  const router = express.Router();
  router.use(protect);

  router.get('/summary', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const requests = await RequestsModel.find({ createdAt: { $gte: since }, userId: req.user._id }).lean();
    const stats = {
      total_requests: 0,
      success_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_latency: 0
    };

    for (const r of requests) {
      stats.total_requests++;
      if (r.status === 'success') stats.success_count++;
      stats.total_input_tokens += (r.inputTokens || 0);
      stats.total_output_tokens += (r.outputTokens || 0);
      if (r.latencyMs) stats.total_latency += r.latencyMs;
    }

    const totalRequests = stats.total_requests;
    const successRate = totalRequests > 0 ? (stats.success_count / totalRequests) * 100 : 0;
    const avgLatency = totalRequests > 0 ? Math.round(stats.total_latency / totalRequests) : 0;

    res.json({
      totalRequests,
      successRate: Math.round(successRate * 10) / 10,
      totalInputTokens: stats.total_input_tokens,
      totalOutputTokens: stats.total_output_tokens,
      avgLatencyMs: avgLatency,
    });
  });

  router.get('/by-model', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const requests = await RequestsModel.find({ createdAt: { $gte: since }, userId: req.user._id }).lean();
    const modelsMap = new Map();

    for (const r of requests) {
      const key = `${r.platform}:${r.modelId}`;
      if (!modelsMap.has(key)) {
        modelsMap.set(key, {
          platform: r.platform,
          modelId: r.modelId,
          requests: 0,
          success_count: 0,
          total_latency: 0,
          total_input_tokens: 0,
          total_output_tokens: 0
        });
      }
      const entry = modelsMap.get(key);
      entry.requests++;
      if (r.status === 'success') entry.success_count++;
      if (r.latencyMs) entry.total_latency += r.latencyMs;
      entry.total_input_tokens += (r.inputTokens || 0);
      entry.total_output_tokens += (r.outputTokens || 0);
    }

    const models = await ModelsModel.find().lean();
    const modelMap = new Map(models.map(m => [m.platform + ':' + m.modelId, m.displayName]));

    const result = Array.from(modelsMap.values()).map(r => ({
      platform: r.platform,
      modelId: r.modelId,
      displayName: modelMap.get(r.platform + ':' + r.modelId) || r.modelId,
      requests: r.requests,
      successRate: Math.round((r.success_count / r.requests) * 100 * 10) / 10,
      avgLatencyMs: r.requests > 0 ? Math.round(r.total_latency / r.requests) : 0,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
    })).sort((a, b) => b.requests - a.requests);

    res.json(result);
  });

  router.get('/by-platform', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const requests = await RequestsModel.find({ createdAt: { $gte: since }, userId: req.user._id }).lean();
    const platformMap = new Map();

    for (const r of requests) {
      if (!platformMap.has(r.platform)) {
        platformMap.set(r.platform, {
          platform: r.platform,
          requests: 0,
          success_count: 0,
          total_latency: 0,
          total_input_tokens: 0,
          total_output_tokens: 0
        });
      }
      const entry = platformMap.get(r.platform);
      entry.requests++;
      if (r.status === 'success') entry.success_count++;
      if (r.latencyMs) entry.total_latency += r.latencyMs;
      entry.total_input_tokens += (r.inputTokens || 0);
      entry.total_output_tokens += (r.outputTokens || 0);
    }

    const result = Array.from(platformMap.values()).map(r => ({
      platform: r.platform,
      requests: r.requests,
      successRate: Math.round((r.success_count / r.requests) * 100 * 10) / 10,
      avgLatencyMs: r.requests > 0 ? Math.round(r.total_latency / r.requests) : 0,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens
    })).sort((a, b) => b.requests - a.requests);

    res.json(result);
  });

  router.get('/timeline', async (req, res) => {
    const range = req.query.range || '7d';
    const interval = req.query.interval || (range === '24h' ? 'hour' : 'day');
    const since = getSinceTimestamp(range);

    const requests = await RequestsModel.find({ createdAt: { $gte: since }, userId: req.user._id }).sort({ createdAt: 1 }).lean();
    const timelineMap = new Map();

    for (const r of requests) {
      let key;
      if (interval === 'hour') {
        const d = new Date(r.createdAt);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00:00`;
      } else {
        const d = new Date(r.createdAt);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      if (!timelineMap.has(key)) {
        timelineMap.set(key, {
          timestamp: key,
          requests: 0,
          successCount: 0,
          failureCount: 0
        });
      }
      const entry = timelineMap.get(key);
      entry.requests++;
      if (r.status === 'success') {
        entry.successCount++;
      } else {
        entry.failureCount++;
      }
    }

    const result = Array.from(timelineMap.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    res.json(result);
  });

  router.get('/error-distribution', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const errors = await RequestsModel.find({ status: 'error', createdAt: { $gte: since }, userId: req.user._id }).lean();
    const categoryMap = new Map();
    const platformMap = new Map();
    const detailedMap = new Map();

    const getCategory = (error) => {
      if (!error) return 'Other';
      const e = error.toLowerCase();
      if (e.includes('429') || e.includes('rate limit') || e.includes('too many') || e.includes('quota')) return 'Rate Limited (429)';
      if (e.includes('401') || e.includes('unauthorized') || e.includes('invalid') || e.includes('key')) return 'Auth Error (401)';
      if (e.includes('403') || e.includes('forbidden')) return 'Forbidden (403)';
      if (e.includes('404') || e.includes('not found')) return 'Not Found (404)';
      if (e.includes('timeout') || e.includes('etimedout') || e.includes('econnrefused')) return 'Timeout/Connection';
      if (e.includes('500') || e.includes('internal server')) return 'Server Error (500)';
      if (e.includes('503') || e.includes('unavailable')) return 'Unavailable (503)';
      return 'Other';
    };

    for (const e of errors) {
      const category = getCategory(e.error);
      const platform = e.platform;
      const detailedKey = `${platform}:${category}`;

      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
      detailedMap.set(detailedKey, (detailedMap.get(detailedKey) || 0) + 1);
    }

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const byPlatform = Array.from(platformMap.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    const detailed = Array.from(detailedMap.entries())
      .map(([key, count]) => {
        const [platform, ...categoryParts] = key.split(':');
        return { platform, error_category: categoryParts.join(':'), count };
      })
      .sort((a, b) => b.count - a.count);

    res.json({ byCategory, byPlatform, detailed });
  });

  router.get('/errors', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const errors = await RequestsModel.find({ status: 'error', createdAt: { $gte: since }, userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(errors.map(e => ({
      id: e._id,
      platform: e.platform,
      modelId: e.modelId,
      error: e.error,
      latencyMs: e.latencyMs,
      createdAt: e.createdAt
    })));
  });

  // Nouveau endpoint: status des circuit breakers
  router.get('/circuit-breakers', async (req, res) => {
    res.json({
      circuitBreakers: getAllCircuitBreakers()
    });
  });

  // Nouveau endpoint: métriques de performance en temps réel
  router.get('/performance-metrics', async (req, res) => {
    res.json({
      metrics: getAllMetrics()
    });
  });

  // Nouveau endpoint: stats du cache
  router.get('/cache-stats', async (req, res) => {
    res.json(getCacheStats());
  });

  return router;
}

module.exports = { createAnalyticsRouter };
