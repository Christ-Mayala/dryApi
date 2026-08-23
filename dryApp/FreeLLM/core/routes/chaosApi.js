/**
 * Chaos Testing API — Endpoints pour contrôler les scénarios de chaos.
 *
 * GET    /api/chaos/status          — Statut chaos
 * GET    /api/chaos/scenarios       — Scénarios disponibles
 * POST   /api/chaos/activate/:name  — Activer un scénario
 * POST   /api/chaos/deactivate/:name — Désactiver un scénario
 * POST   /api/chaos/deactivate-all  — Tout désactiver
 * POST   /api/chaos/preset/:name    — Activer un preset
 * GET    /api/chaos/stats           — Statistiques
 * POST   /api/chaos/seed            — Générer une seed aléatoire
 */

const express = require('express');
const { chaosInjector, ChaosScenario } = require('../services/chaosTesting.js');

function createChaosApiRoutes() {
  const router = express.Router();

  // ─── GET /chaos/status ──────────────────────────────────
  router.get('/status', (req, res) => {
    const status = chaosInjector.getStatus();
    res.json({
      enabled: status.enabled,
      active: status.active,
      totalTriggers: status.totalTriggers,
    });
  });

  // ─── GET /chaos/scenarios ───────────────────────────────
  router.get('/scenarios', (req, res) => {
    const scenarios = Object.values(ChaosScenario).map(name => ({
      name,
      description: chaosInjector._defaultMessage(name, 'provider'),
    }));
    res.json({ object: 'list', data: scenarios });
  });

  // ─── POST /chaos/inject/:provider ───────────────────────
  router.post('/inject/:provider', (req, res) => {
    const { provider } = req.params;
    const { scenario, probability, duration } = req.body || {};

    if (!scenario || !Object.values(ChaosScenario).includes(scenario)) {
      return res.status(400).json({
        error: {
          message: `Invalid scenario. Valid: ${Object.values(ChaosScenario).join(', ')}`,
          type: 'invalid_request_error',
        },
      });
    }

    chaosInjector.inject(provider, scenario, {
      probability: probability || 0.5,
      duration: duration || 60000,
    });

    res.json({ success: true, provider, scenario, active: true });
  });

  // ─── POST /chaos/clear/:provider ────────────────────────
  router.post('/clear/:provider', (req, res) => {
    chaosInjector.remove(req.params.provider);
    res.json({ success: true, provider: req.params.provider });
  });

  // ─── POST /chaos/clear-all ──────────────────────────────
  router.post('/clear-all', (req, res) => {
    chaosInjector.disable();
    chaosInjector.enable(); // Re-enable with clean state
    res.json({ success: true, message: 'All chaos cleared' });
  });

  // ─── POST /chaos/enable ─────────────────────────────────
  router.post('/enable', (req, res) => {
    chaosInjector.enable();
    res.json({ success: true, enabled: true });
  });

  // ─── POST /chaos/disable ────────────────────────────────
  router.post('/disable', (req, res) => {
    chaosInjector.disable();
    res.json({ success: true, enabled: false });
  });

  // ─── GET /chaos/stats ───────────────────────────────────
  router.get('/stats', (req, res) => {
    const status = chaosInjector.getStatus();
    res.json({
      enabled: status.enabled,
      activeScenarios: status.active,
      totalTriggers: status.totalTriggers,
      log: chaosInjector.injectionLog.slice(-20),
    });
  });

  return router;
}

module.exports = { createChaosApiRoutes };
