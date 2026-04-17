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

const registerHealthRoutes = (app) => {
  app.get('/', async (req, res) => {
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

  app.get('/health/live', async (req, res) => {
    const liveness = await healthService.getLiveness();
    res.status(200).json(liveness);
  });

  app.get('/health/ready', async (req, res) => {
    const readiness = await healthService.getReadiness();
    const statusCode = readiness.status === 'READY' ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  app.get('/system/status.json', async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).json(overview);
  });

  app.get('/system/status', async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).send(healthService.renderSystemStatusPage(overview));
  });

  // Nouveaux endpoints pour les actions système
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

const registerApplicationRoutes = (app) => {
  bootstrapApps(app);
  registerHealthRoutes(app);
  registerDocumentationRoutes(app);

  app.use((req, res) => sendResponse(res, null, 'Route introuvable', false));
  app.use(handleCsrfError);
  app.use(errorHandler);
};

module.exports = {
  registerApplicationRoutes,
  registerDocumentationRoutes,
  registerHealthRoutes,
};
