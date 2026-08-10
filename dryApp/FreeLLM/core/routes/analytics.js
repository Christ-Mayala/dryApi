const express = require('express');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;
const { getAllCircuitBreakers } = require('../services/circuitBreaker.js');
const { getAllMetrics } = require('../services/performanceMetrics.js');
const { getStats: getCacheStats } = require('../services/responseCache.js');
const { fallbackMetrics, MAX_FALLBACKS } = require('../routes/inferenceOsProxy.js');
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

function getErrorCategory(error) {
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
}

function createAnalyticsRouter(ModelsModel, RequestsModel) {
  const router = express.Router();
  router.use(protect);

  // GET /api/analytics/summary
  router.get('/summary', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const result = await RequestsModel.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: null,
          total_requests: { $sum: 1 },
          success_count: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          total_input_tokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
          total_output_tokens: { $sum: { $ifNull: ['$outputTokens', 0] } },
          total_latency: { $sum: { $ifNull: ['$latencyMs', 0] } }
        }
      }
    ]);

    const stats = result[0] || {
      total_requests: 0,
      success_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_latency: 0
    };

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

  // GET /api/analytics/by-model
  router.get('/by-model', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const models = await ModelsModel.find().lean();
    const modelMap = new Map(models.map(m => [m.platform + ':' + m.modelId, m.displayName]));

    const result = await RequestsModel.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: { platform: '$platform', modelId: '$modelId' },
          requests: { $sum: 1 },
          success_count: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          total_latency: { $sum: { $ifNull: ['$latencyMs', 0] } },
          total_input_tokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
          total_output_tokens: { $sum: { $ifNull: ['$outputTokens', 0] } }
        }
      },
      {
        $sort: { requests: -1 }
      }
    ]);

    const formatted = result.map(r => ({
      platform: r._id.platform,
      modelId: r._id.modelId,
      displayName: modelMap.get(r._id.platform + ':' + r._id.modelId) || r._id.modelId,
      requests: r.requests,
      successRate: Math.round((r.success_count / r.requests) * 100 * 10) / 10,
      avgLatencyMs: r.requests > 0 ? Math.round(r.total_latency / r.requests) : 0,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
    }));

    res.json(formatted);
  });

  // GET /api/analytics/by-platform
  router.get('/by-platform', async (req, res) => {
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const result = await RequestsModel.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$platform',
          requests: { $sum: 1 },
          success_count: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          total_latency: { $sum: { $ifNull: ['$latencyMs', 0] } },
          total_input_tokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
          total_output_tokens: { $sum: { $ifNull: ['$outputTokens', 0] } }
        }
      },
      {
        $sort: { requests: -1 }
      }
    ]);

    const formatted = result.map(r => ({
      platform: r._id,
      requests: r.requests,
      successRate: Math.round((r.success_count / r.requests) * 100 * 10) / 10,
      avgLatencyMs: r.requests > 0 ? Math.round(r.total_latency / r.requests) : 0,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens
    }));

    res.json(formatted);
  });

  // GET /api/analytics/timeline
  router.get('/timeline', async (req, res) => {
    const range = req.query.range || '7d';
    const interval = req.query.interval || (range === '24h' ? 'hour' : 'day');
    const since = getSinceTimestamp(range);

    const dateFormat = interval === 'hour'
      ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' }, hour: { $hour: '$createdAt' } }
      : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

    const dateToString = interval === 'hour'
      ? { $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$createdAt' } }
      : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

    const result = await RequestsModel.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: dateToString,
          requests: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failureCount: { $sum: { $cond: [{ $ne: ['$status', 'success'] }, 1, 0] } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const formatted = result.map(r => ({
      timestamp: r._id,
      requests: r.requests,
      successCount: r.successCount,
      failureCount: r.failureCount
    }));

    res.json(formatted);
  });

  // GET /api/analytics/error-distribution
  router.get('/error-distribution', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const errors = await RequestsModel.find({
      status: 'error',
      createdAt: { $gte: since },
      userId: req.user._id
    }).lean();

    const categoryMap = new Map();
    const platformMap = new Map();
    const detailedMap = new Map();

    for (const e of errors) {
      const category = getErrorCategory(e.error);
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

  // GET /api/analytics/errors
  router.get('/errors', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const range = req.query.range || '7d';
    const since = getSinceTimestamp(range);

    const errors = await RequestsModel.find({
      status: 'error',
      createdAt: { $gte: since },
      userId: req.user._id
    })
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

  // GET /api/analytics/circuit-breakers
  router.get('/circuit-breakers', async (req, res) => {
    res.json({
      circuitBreakers: getAllCircuitBreakers()
    });
  });

  // GET /api/analytics/performance-metrics
  router.get('/performance-metrics', async (req, res) => {
    res.json({
      metrics: getAllMetrics()
    });
  });

  // GET /api/analytics/cache-stats
  router.get('/cache-stats', async (req, res) => {
    res.json(getCacheStats());
  });

  // GET /api/analytics/fallback-metrics
  router.get('/fallback-metrics', async (req, res) => {
    const providerStats = {};
    for (const [platform, stats] of fallbackMetrics.providerStats.entries()) {
      providerStats[platform] = {
        ...stats,
        successRate: stats.requests > 0 ? (stats.successes / stats.requests) * 100 : 0,
        fallbackRate: stats.requests > 0 ? (stats.fallbacks / stats.requests) * 100 : 0
      };
    }
    res.json({
      totalRequests: fallbackMetrics.totalRequests,
      totalFallbacks: fallbackMetrics.totalFallbacks,
      totalNetworkRetries: fallbackMetrics.totalNetworkRetries,
      totalTimeouts: fallbackMetrics.totalTimeouts,
      maxFallbacks: MAX_FALLBACKS,
      providerStats
    });
  });

  return router;
}

module.exports = { createAnalyticsRouter };
