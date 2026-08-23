/**
 * Chaos Testing API Routes — Endpoints pour gérer les tests de résilience.
 *
 * Routes :
 *   GET  /api/chaos/status     → État actuel du chaos
 *   POST /api/chaos/enable     → Activer le chaos testing
 *   POST /api/chaos/disable    → Désactiver tout le chaos
 *   POST /api/chaos/inject     → Injecter un scénario sur un provider
 *   POST /api/chaos/remove     → Supprimer le chaos d'un provider
 *   POST /api/chaos/preset     → Appliquer un preset de chaos prédéfini
 *
 * ATTENTION : Ces routes ne doivent JAMAIS être exposées en production.
 */

const express = require('express');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;
const { chaosInjector, ChaosScenario } = require('../services/chaosTesting');

/**
 * Presets de chaos prédéfinis pour tester des scénarios courants.
 */
const CHAOS_PRESETS = {
  // Tous les providers timeout aléatoirement
  'random-timeout': () => {
    chaosInjector.enable();
    const providers = ['groq', 'google', 'openai', 'mistral', 'cerebras'];
    for (const p of providers) {
      chaosInjector.inject(p, ChaosScenario.PROVIDER_DOWN, { probability: 0.3 });
    }
  },

  // Un provider DOWN, les autres ralentis
  'provider-down': () => {
    chaosInjector.enable();
    chaosInjector.inject('groq', ChaosScenario.PROVIDER_DOWN);
    chaosInjector.inject('google', ChaosScenario.LATENCY_SPIKE, { latencyMs: 3000 });
    chaosInjector.inject('openai', ChaosScenario.LATENCY_SPIKE, { latencyMs: 5000 });
  },

  // Tout le monde rate-limited
  'mass-rate-limit': () => {
    chaosInjector.enable();
    chaosInjector.inject('groq', ChaosScenario.RATE_LIMIT);
    chaosInjector.inject('openai', ChaosScenario.RATE_LIMIT);
    chaosInjector.inject('google', ChaosScenario.RATE_LIMIT);
  },

  // Cascade de pannes
  'cascade-failure': () => {
    chaosInjector.enable();
    chaosInjector.inject('groq', ChaosScenario.PROVIDER_DOWN, { duration: 30000 });
    chaosInjector.inject('cerebras', ChaosScenario.NETWORK_FAILURE, { duration: 30000 });
    chaosInjector.inject('sambanova', ChaosScenario.QUOTA_EXHAUSTED, { duration: 60000 });
  },

  // Mode dégradé complet
  'total-outage': () => {
    chaosInjector.enable();
    const providers = ['groq', 'google', 'openai', 'mistral', 'cerebras', 'sambanova', 'nvidia', 'openrouter'];
    for (const p of providers) {
      chaosInjector.inject(p, ChaosScenario.PROVIDER_DOWN);
    }
  },
};

function createChaosRouter() {
  const router = express.Router();
  router.use(protect);

  // Only allow in non-production
  router.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: { message: 'Chaos testing is not available in production', type: 'forbidden' }
      });
    }
    next();
  });

  // GET /api/chaos/status
  router.get('/status', (req, res) => {
    res.json(chaosInjector.getStatus());
  });

  // POST /api/chaos/enable
  router.post('/enable', (req, res) => {
    chaosInjector.enable();
    res.json({ success: true, message: 'Chaos testing enabled' });
  });

  // POST /api/chaos/disable
  router.post('/disable', (req, res) => {
    chaosInjector.disable();
    res.json({ success: true, message: 'Chaos testing disabled' });
  });

  // POST /api/chaos/inject
  router.post('/inject', (req, res) => {
    const { provider, scenario, options } = req.body;

    if (!provider || !scenario) {
      return res.status(400).json({
        error: { message: 'provider and scenario are required' }
      });
    }

    if (!Object.values(ChaosScenario).includes(scenario)) {
      return res.status(400).json({
        error: {
          message: `Invalid scenario. Valid: ${Object.values(ChaosScenario).join(', ')}`,
        }
      });
    }

    chaosInjector.enable();
    chaosInjector.inject(provider, scenario, options || {});
    res.json({
      success: true,
      message: `Chaos '${scenario}' injected on ${provider}`,
      status: chaosInjector.getStatus(),
    });
  });

  // POST /api/chaos/remove
  router.post('/remove', (req, res) => {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: { message: 'provider is required' } });
    }
    chaosInjector.remove(provider);
    res.json({ success: true, message: `Chaos removed from ${provider}` });
  });

  // POST /api/chaos/preset
  router.post('/preset', (req, res) => {
    const { preset } = req.body;
    if (!preset || !CHAOS_PRESETS[preset]) {
      return res.status(400).json({
        error: {
          message: `Invalid preset. Available: ${Object.keys(CHAOS_PRESETS).join(', ')}`,
        }
      });
    }

    CHAOS_PRESETS[preset]();
    res.json({
      success: true,
      message: `Chaos preset '${preset}' applied`,
      status: chaosInjector.getStatus(),
    });
  });

  // GET /api/chaos/scenarios — List available scenarios
  router.get('/scenarios', (req, res) => {
    res.json({
      scenarios: Object.values(ChaosScenario),
      presets: Object.keys(CHAOS_PRESETS),
    });
  });

  return router;
}

module.exports = { createChaosRouter, CHAOS_PRESETS };
