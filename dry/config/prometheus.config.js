/**
 * Configuration Prometheus / Métriques
 * Exposition des métriques au format Prometheus pour le monitoring
 * @module dry/config/prometheus.config
 */

const promClient = require('prom-client');

// Vérifier si le registre est déjà initialisé (éviter les doublons)
let initialized = false;

/**
 * Crée et enregistre toutes les métriques Prometheus
 * @returns {object} Collection des métriques
 */
const createMetrics = () => {
  if (initialized) {
    return getMetrics();
  }

  // Collecte automatique des métriques par défaut (GC, mémoire, CPU)
  promClient.collectDefaultMetrics({
    prefix: 'dry_',
    labels: { app: 'dry-api' },
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });

  /**
   * Compteur de requêtes HTTP par méthode, route et statut
   */
  const httpRequestsTotal = new promClient.Counter({
    name: 'dry_http_requests_total',
    help: 'Nombre total de requêtes HTTP reçues',
    labelNames: ['method', 'route', 'status', 'app'],
  });

  /**
   * Durée des requêtes HTTP (histogramme)
   */
  const httpRequestDurationSeconds = new promClient.Histogram({
    name: 'dry_http_request_duration_seconds',
    help: 'Distribution des durées de requêtes HTTP en secondes',
    labelNames: ['method', 'route', 'status', 'app'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  /**
   * Taille des requêtes HTTP
   */
  const httpRequestSizeBytes = new promClient.Histogram({
    name: 'dry_http_request_size_bytes',
    help: 'Distribution de la taille des requêtes HTTP en bytes',
    labelNames: ['method', 'route'],
    buckets: [100, 1000, 5000, 10000, 100000, 500000, 1000000, 5000000],
  });

  /**
   * Taille des réponses HTTP
   */
  const httpResponseSizeBytes = new promClient.Histogram({
    name: 'dry_http_response_size_bytes',
    help: 'Distribution de la taille des réponses HTTP en bytes',
    labelNames: ['method', 'route', 'status'],
    buckets: [100, 1000, 5000, 10000, 100000, 500000, 1000000],
  });

  /**
   * Durée des requêtes base de données
   */
  const dbQueryDurationSeconds = new promClient.Histogram({
    name: 'dry_db_query_duration_seconds',
    help: 'Distribution des durées de requêtes base de données',
    labelNames: ['operation', 'collection'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  });

  /**
   * Connexions base de données actives
   */
  const dbConnections = new promClient.Gauge({
    name: 'dry_db_connections',
    help: 'Nombre de connexions base de données actives',
    labelNames: ['state'],
  });

  /**
   * Compteur d'erreurs
   */
  const errorsTotal = new promClient.Counter({
    name: 'dry_errors_total',
    help: 'Nombre total d\'erreurs par type',
    labelNames: ['type', 'service', 'app'],
  });

  /**
   * Cache hits et misses
   */
  const cacheHitsTotal = new promClient.Counter({
    name: 'dry_cache_hits_total',
    help: 'Nombre total de hits du cache',
    labelNames: ['cache'],
  });

  const cacheMissesTotal = new promClient.Counter({
    name: 'dry_cache_misses_total',
    help: 'Nombre total de misses du cache',
    labelNames: ['cache'],
  });

  /**
   * Connexions WebSocket actives
   */
  const wsConnections = new promClient.Gauge({
    name: 'dry_ws_connections',
    help: 'Nombre de connexions WebSocket actives',
  });

  /**
   * Utilisateurs actifs
   */
  const activeUsers = new promClient.Gauge({
    name: 'dry_active_users',
    help: 'Nombre d\'utilisateurs actifs',
    labelNames: ['app'],
  });

  initialized = true;

  return {
    httpRequestsTotal,
    httpRequestDurationSeconds,
    httpRequestSizeBytes,
    httpResponseSizeBytes,
    dbQueryDurationSeconds,
    dbConnections,
    errorsTotal,
    cacheHitsTotal,
    cacheMissesTotal,
    wsConnections,
    activeUsers,
    register: promClient.register,
  };
};

/**
 * Récupère les métriques existantes
 * @returns {object} Collection des métriques
 */
const getMetrics = () => {
  const register = promClient.register;
  return {
    register,
    // Métriques optionnelles - peuvent ne pas exister si non initialisées
    httpRequestsTotal: register.getSingleMetric('dry_http_requests_total'),
    httpRequestDurationSeconds: register.getSingleMetric('dry_http_request_duration_seconds'),
    httpRequestSizeBytes: register.getSingleMetric('dry_http_request_size_bytes'),
    httpResponseSizeBytes: register.getSingleMetric('dry_http_response_size_bytes'),
    dbQueryDurationSeconds: register.getSingleMetric('dry_db_query_duration_seconds'),
    dbConnections: register.getSingleMetric('dry_db_connections'),
    errorsTotal: register.getSingleMetric('dry_errors_total'),
    cacheHitsTotal: register.getSingleMetric('dry_cache_hits_total'),
    cacheMissesTotal: register.getSingleMetric('dry_cache_misses_total'),
    wsConnections: register.getSingleMetric('dry_ws_connections'),
    activeUsers: register.getSingleMetric('dry_active_users'),
  };
};

/**
 * Middleware Express pour exposer les métriques Prometheus
 * GET /metrics → texte au format Prometheus
 */
const metricsMiddleware = async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métriques',
      error: error.message,
    });
  }
};

/**
 * Middleware de tracking des requêtes HTTP (à utiliser sur toutes les routes)
 * Enregistre durée, statut, taille
 */
const httpMetricsMiddleware = (metrics) => {
  return (req, res, next) => {
    if (!metrics.httpRequestsTotal) {
      return next();
    }

    const start = Date.now();
    // Utiliser l'événement 'finish' pour éviter les conflits avec d'autres middlewares
    // (comme le middleware d'audit) qui interceptent aussi res.end
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.originalUrl;
      const labels = {
        method: req.method,
        route,
        status: res.statusCode,
        app: req.appName || 'unknown',
      };

      if (metrics.httpRequestsTotal) {
        metrics.httpRequestsTotal.inc(labels);
      }
      if (metrics.httpRequestDurationSeconds) {
        metrics.httpRequestDurationSeconds.observe(labels, duration);
      }
    });

    next();
  };
};

module.exports = {
  createMetrics,
  getMetrics,
  metricsMiddleware,
  httpMetricsMiddleware,
};
