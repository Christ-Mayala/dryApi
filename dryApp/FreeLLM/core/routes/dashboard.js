/**
 * Dashboard Routes — Endpoints pour le tableau de bord système.
 *
 * Routes :
 *   GET /api/dashboard/overview      → Vue d'ensemble du système
 *   GET /api/dashboard/providers     → Carte des providers (santé, métriques)
 *   GET /api/dashboard/routing       → Visualisation du routing
 *   GET /api/dashboard/traces        → Traces de requêtes récentes
 *   GET /api/dashboard/trace/:id     → Trace détaillée d'une requête
 *   GET /api/dashboard/slow          → Requêtes lentes
 *   GET /api/dashboard/errors        → Erreurs récentes
 *   GET /api/dashboard/capabilities  → Carte des capabilities des modèles
 */

const express = require('express');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;
const { observability } = require('../services/observability');
const { monitor: healthMonitor } = require('../services/providerHealthMonitor');
const cbV2 = require('../services/circuitBreaker');
const { degradedMode } = require('../services/degradedMode');
const { chaosInjector } = require('../services/chaosTesting');
const policyEngine = require('../services/policyEngine');
const { quotaEngine } = require('../services/quotaEngine');
const capabilityRegistry = require('../services/modelCapabilityRegistry');
const { streamManager } = require('../services/streamingRecovery');
const { getStats: getCacheStats } = require('../services/responseCache');
const { tokenOptimization } = require('../services/tokenOptimization.js');
const { mcpClient } = require('../services/mcpClient.js');

function createDashboardRouter(ModelsModel, ApiKeysModel) {
  const router = express.Router();
  router.use(protect);

  // GET /api/dashboard/overview — System overview
  router.get('/overview', async (req, res) => {
    const keyCount = await ApiKeysModel.countDocuments({ deletedAt: null, userId: req.user._id, enabled: true });
    const modelCount = await ModelsModel.countDocuments({ deletedAt: null, enabled: true });

    const metrics = observability.getMetrics();
    const health = healthMonitor.getAllHealth();
    const circuits = cbV2.getAllStatus();
    const degraded = degradedMode.getStatus();
    const chaos = chaosInjector.getStatus();
    const cacheStats = getCacheStats();
    const streamStats = streamManager.getStats();

    const healthyProviders = health.filter(h => h.successRate > 0.9).length;
    const openCircuits = circuits.filter(c => c.state === 'open').length;

    res.json({
      system: {
        status: degraded.state === 'normal' ? 'healthy' : degraded.state,
        uptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
      providers: {
        total: health.length,
        healthy: healthyProviders,
        degraded: health.filter(h => h.successRate > 0.5 && h.successRate <= 0.9).length,
        unhealthy: health.filter(h => h.successRate <= 0.5).length,
        openCircuits,
      },
      models: { total: modelCount },
      keys: { total: keyCount },
      requests: {
        total: metrics.totalRequests,
        successRate: metrics.successRate,
        errorRate: metrics.errorRate,
        avgLatencyMs: metrics.avgLatencyMs,
        totalTokens: metrics.totalTokensUsed,
        cacheHitRate: metrics.cacheHitRate,
      },
      fallbacks: {
        total: metrics.totalFallbacks,
        rate: metrics.totalRequests > 0
          ? ((metrics.totalFallbacks / metrics.totalRequests) * 100).toFixed(1) + '%'
          : '0%',
      },
      cache: cacheStats,
      streaming: streamStats,
      degraded: degraded,
      chaos: chaos,
    });
  });

  // GET /api/dashboard/providers — Provider health map
  router.get('/providers', (req, res) => {
    const health = healthMonitor.getAllHealth();
    const circuits = cbV2.getAllStatus();
    const circuitMap = new Map(circuits.map(c => [c.provider, c]));

    const providers = health.map(h => ({
      ...h,
      circuitBreaker: circuitMap.get(h.provider) || { state: 'unknown' },
      healthScore: healthMonitor.getHealthScore(h.provider),
    }));

    res.json(providers.sort((a, b) => b.healthScore - a.healthScore));
  });

  // GET /api/dashboard/routing — Routing visualization
  router.get('/routing', (req, res) => {
    const metrics = observability.getMetrics();
    const ranked = healthMonitor.getRankedProviders();

    res.json({
      providerRanking: ranked,
      byProvider: metrics.byProvider,
      byTaskType: metrics.byTaskType,
      recentFallbacks: observability.getRecentTraces(20).filter(t => t.fallbackCount > 0),
    });
  });

  // GET /api/dashboard/traces — Recent request traces
  router.get('/traces', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const traces = observability.getRecentTraces(limit);
    res.json(traces.map(t => ({
      requestId: t.requestId,
      status: t.status,
      provider: t.provider,
      modelId: t.modelId,
      taskType: t.taskType,
      latencyMs: t.latencyMs,
      tokens: t.totalTokens,
      fallbackCount: t.fallbackCount,
      cacheHit: t.cacheHit,
      stream: t.stream,
      isIdeMode: t.isIdeMode,
      errorCategory: t.errorCategory,
      createdAt: t.createdAt,
    })));
  });

  // GET /api/dashboard/trace/:id — Detailed trace
  router.get('/trace/:id', (req, res) => {
    const trace = observability.getTrace(req.params.id);
    if (!trace) {
      return res.status(404).json({ error: { message: 'Trace not found' } });
    }
    res.json(trace);
  });

  // GET /api/dashboard/slow — Slow requests
  router.get('/slow', (req, res) => {
    const threshold = parseInt(req.query.threshold) || 5000;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    res.json(observability.getSlowRequests(threshold, limit));
  });

  // GET /api/dashboard/errors — Error summary
  router.get('/errors', (req, res) => {
    const metrics = observability.getMetrics();
    const errorTraces = observability.getRecentTraces(100).filter(t => t.status === 'error');

    res.json({
      categories: metrics.errorCategories,
      recent: errorTraces.slice(0, 20).map(t => ({
        requestId: t.requestId,
        provider: t.provider,
        errorCategory: t.errorCategory,
        taskType: t.taskType,
        latencyMs: t.latencyMs,
        createdAt: t.createdAt,
      })),
    });
  });

  // GET /api/dashboard/capabilities — Model capability map
  router.get('/capabilities', (req, res) => {
    const allCaps = capabilityRegistry.getAllCapabilities();

    // Group by capability
    const byCapability = {};
    for (const cap of allCaps) {
      for (const [key, value] of Object.entries(cap)) {
        if (typeof value === 'boolean' && value) {
          if (!byCapability[key]) byCapability[key] = [];
          byCapability[key].push(`${cap.platform}:${cap.modelId}`);
        }
      }
    }

    res.json({
      totalModels: allCaps.length,
      models: allCaps,
      byCapability,
    });
  });

  // GET /api/dashboard/system — System health summary
  router.get('/system', (req, res) => {
    res.json({
      health: healthMonitor.getAllHealth(),
      circuitBreakers: cbV2.getAllStatus(),
      degradedMode: degradedMode.getStatus(),
      policies: policyEngine.getActiveRules().filter(r => r.enabled),
      quotas: quotaEngine.getAllProviderQuotas(),
      chaos: chaosInjector.getStatus(),
      cache: getCacheStats(),
      streaming: streamManager.getStats(),
      observability: observability.getMetrics(),
    });
  });

  // GET /api/dashboard/token-optimization — Token optimization metrics
  router.get('/token-optimization', (req, res) => {
    const stats = tokenOptimization.getStats();
    const recentMetrics = tokenOptimization.getRecentMetrics(20);
    res.json({
      stats: {
        totalRequests: stats.totalRequests,
        optimizedRequests: stats.optimizedRequests,
        optimizationRate: stats.totalRequests > 0
          ? ((stats.optimizedRequests / stats.totalRequests) * 100).toFixed(1) + '%'
          : '0%',
        tokensBefore: stats.tokensBefore,
        tokensAfter: stats.tokensAfter,
        tokensSaved: stats.totalSaved,
        avgReduction: stats.avgReduction,
        deduplicationCount: stats.deduplicationCount,
        compressionCount: stats.compressionCount,
        summaryCount: stats.summaryCount,
        errors: stats.errors,
        avgOptimizationTime: stats.avgOptimizationTime,
      },
      config: tokenOptimization.getConfig(),
      recentRequests: recentMetrics,
    });
  });

  // GET /api/dashboard/mcp — MCP status overview
  router.get('/mcp', (req, res) => {
    res.json(mcpClient.getStatus());
  });

  return router;
}

module.exports = { createDashboardRouter };
