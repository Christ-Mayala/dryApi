/**
 * Token Optimization Routes — API endpoints pour config et métriques.
 *
 * GET  /api/token-optimization/config  — Configuration actuelle
 * PATCH /api/token-optimization/config  — Modifier la config
 * GET  /api/token-optimization/stats    — Statistiques globales
 * GET  /api/token-optimization/requests/:requestId — Détail d'une requête
 */

const express = require('express');
const { tokenOptimization, getConfig, setConfig } = require('../services/tokenOptimization.js');

function createTokenOptimizationRoutes() {
  const router = express.Router();

  // GET /api/token-optimization/config
  router.get('/config', (req, res) => {
    const config = getConfig();
    res.json({
      mode: config.mode,
      thresholds: config.thresholds,
      protectedPriorityLevels: config.protectedPriorityLevels,
      deduplication: { enabled: config.deduplication.enabled, nearDuplicateThreshold: config.nearDuplicateThreshold },
      compression: { enabled: config.compressionEnabled },
      summary: { enabled: config.summaryEnabled, minMessagesForSummary: config.minMessagesForSummary },
    });
  });

  // PATCH /api/token-optimization/config
  router.patch('/config', (req, res) => {
    const { mode, thresholds, deduplication, compression, summary } = req.body;
    const updates = {};
    if (mode !== undefined) updates.mode = mode;
    if (thresholds) updates.thresholds = thresholds;
    if (deduplication !== undefined) updates.deduplication = typeof deduplication === 'boolean' ? { enabled: deduplication } : deduplication;
    if (compression !== undefined) updates.compressionEnabled = typeof compression === 'boolean' ? compression : compression?.enabled;
    if (summary !== undefined) updates.summaryEnabled = typeof summary === 'boolean' ? summary : summary?.enabled;

    setConfig(updates);
    res.json({ success: true, config: getConfig() });
  });

  // GET /api/token-optimization/stats
  router.get('/stats', (req, res) => {
    const stats = tokenOptimization.getStats();
    res.json(stats);
  });

  // GET /api/token-optimization/requests/:requestId
  router.get('/requests/:requestId', (req, res) => {
    const stats = tokenOptimization.getStats();
    const reqDetail = stats.recentRequests?.find(r => r.requestId === req.params.requestId);
    if (!reqDetail) {
      return res.status(404).json({ error: { message: 'Request not found or not optimized', type: 'not_found' } });
    }
    res.json(reqDetail);
  });

  return router;
}

module.exports = { createTokenOptimizationRoutes };
