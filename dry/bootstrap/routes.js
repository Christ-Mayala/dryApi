const bootstrapApps = require('../core/application/bootloader');
const errorHandler = require('../middlewares/error/errorHandler');
const { handleCsrfError } = require('../middlewares/protection/csrf.middleware');
const sendResponse = require('../utils/http/response');
const healthService = require('../services/health/health.service');
const systemActionsService = require('../services/system/system-actions.service');
const {
  swaggerUiMiddleware,
  swaggerUiSetup,
  generateSwaggerRoutes,
} = require('../utils/documentation/swagger.util');

// Nouveaux modules (Phase 2)
const { createMetrics, httpMetricsMiddleware } = require('../config/prometheus.config');
const healthRoutes = require('../routes/health.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const licensingRoutes = require('../modules/licensing/licensing.routes');

const registerHealthRoutes = (app) => {
  // Route racine avec status du serveur (déplacée sur /health/root pour ne pas conflit avec la landing page)
  app.get('/health/root', async (req, res) => {
    try {
      const health = await healthService.getHealthStatus();
      const statusCode = health.status === 'OK' ? 200 : 503;
      res.status(statusCode).json({
        success: health.status === 'OK',
        message: 'DRY Multi-Tenant Server Running',
        ...health,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: 'Health check failed',
        error: error.message,
      });
    }
  });

  // Endpoints de health dédiés (montés dans /health via healthRoutes)
  app.use('/health', healthRoutes);

  // Métriques Prometheus (/metrics) via le routeur health
  // Note: GET /metrics est géré par healthRoutes

  // System status
  app.get('/system/status.json', async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).json(overview);
  });

  app.get('/system/status', async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).send(healthService.renderSystemStatusPage(overview));
  });

  // Actions système
  app.post('/system/actions/create-app', async (req, res) => {
    const { appName, template, addons } = req.body;
    try {
      const result = await systemActionsService.createApp(appName, template, addons);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/system/actions/:actionId', async (req, res) => {
    const { actionId } = req.params;
    try {
      const result = await systemActionsService.runCommand(actionId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

const registerDocumentationRoutes = (app) => {
  const swaggerSpecs = generateSwaggerRoutes();

  app.use('/api-docs', swaggerUiMiddleware, swaggerUiSetup);
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
  });
};

const registerApplicationRoutes = async (app) => {
  // Initialiser les métriques Prometheus
  const metrics = createMetrics();
  
  // Middleware de tracking HTTP Prometheus (après toutes les routes)
  app.use(httpMetricsMiddleware(metrics));

  // Bootstrap des apps multi-tenant
  await bootstrapApps(app);

  // Routes système
  registerHealthRoutes(app);
  registerDocumentationRoutes(app);

  // Routes billing (monté dans l'espace API)
  app.use('/api/v1/billing', billingRoutes);

  // Routes licensing
  app.use('/api/v1/licensing', licensingRoutes);

  // 404
  app.use((req, res) => sendResponse(res, null, 'Route introuvable', false));
  
  // Gestion d'erreurs
  app.use(handleCsrfError);
  app.use(errorHandler);
};

module.exports = {
  registerApplicationRoutes,
  registerDocumentationRoutes,
  registerHealthRoutes,
};
