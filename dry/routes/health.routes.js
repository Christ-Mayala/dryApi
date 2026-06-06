/**
 * Routes de Health Check
 * Endpoints de readiness, liveness et startup probes pour Kubernetes et monitoring
 * @module dry/routes/health.routes
 */

const express = require('express');
const healthService = require('../services/health/health.service');
const config = require('../../config/database');

// Note: Ce fichier utilise console directement car il peut être chargé avant l'initialisation
// du logger Winston. En production, intégrer dry/config/logger.config.js dans le bootstrap.

const router = express.Router();

/**
 * GET /health/live
 * Liveness probe - Vérifie que l'application tourne
 * Utilisé par Kubernetes et les load balancers
 */
router.get('/live', async (req, res) => {
  try {
    const liveness = await healthService.getLiveness();
    res.status(200).json(liveness);
  } catch (error) {
    console.error(`[Health] Liveness check échoué: ${error.message}`);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Liveness check failed',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe - Vérifie que l'app est prête à accepter du trafic
 * Vérifie: Connexion DB, Cache, Mémoire
 */
router.get('/ready', async (req, res) => {
  try {
    const readiness = await healthService.getReadiness();
    const statusCode = readiness.status === 'READY' ? 200 : 503;

    res.status(statusCode).json({
      status: readiness.status,
      timestamp: readiness.timestamp,
      uptime_ms: Math.floor(process.uptime() * 1000),
      checks: {
        database: {
          status: readiness.checks.database ? 'ok' : 'degraded',
          latency_ms: readiness.checks.databaseLatency || 0,
        },
        cache: {
          status: readiness.checks.redis === true ? 'ok' : readiness.checks.redis === 'DISABLED' ? 'disabled' : 'degraded',
          latency_ms: readiness.checks.redisLatency || 0,
        },
        memory: {
          status: 'ok',
          usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        },
        disk: {
          status: 'ok',
          usage_percent: 0, // À implémenter avec disk space check
        },
      },
      version: config.APP_VERSION || '1.0.0',
      environment: config.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error(`[Health] Readiness check échoué: ${error.message}`);
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      message: 'Readiness check failed',
    });
  }
});

/**
 * GET /health/startup
 * Startup probe - Vérifie que l'app est entièrement initialisée
 * Utilisé par Kubernetes pour savoir quand l'app est prête à recevoir du trafic
 */
router.get('/startup', async (req, res) => {
  try {
    // Vérifier que tous les services sont initialisés
    const health = await healthService.getHealthStatus();
    const allInitialized = health.status === 'OK';

    res.status(allInitialized ? 200 : 503).json({
      status: allInitialized ? 'INITIALIZED' : 'INITIALIZING',
      timestamp: new Date().toISOString(),
      services: {
        database: health.services.database.status === 'UP',
        redis: health.services.redis.connected || !health.services.redis.enabled,
        applications: health.services.applications.length > 0,
      },
      version: config.APP_VERSION || '1.0.0',
    });
  } catch (error) {
    console.error(`[Health] Startup check échoué: ${error.message}`);
    res.status(503).json({
      status: 'INITIALIZING',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health
 * Vue d'ensemble complète de la santé du système
 */
router.get('/', async (req, res) => {
  try {
    const health = await healthService.getHealthStatus();
    res.status(health.status === 'OK' ? 200 : 503).json(health);
  } catch (error) {
    console.error(`[Health] Check échoué: ${error.message}`);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

/**
 * GET /metrics
 * Exposition des métriques au format Prometheus
 */
router.get('/metrics', async (req, res) => {
  try {
    const { metricsMiddleware } = require('../config/prometheus.config');
    await metricsMiddleware(req, res);
  } catch (error) {
    console.error(`[Metrics] Erreur: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métriques',
    });
  }
});

module.exports = router;
