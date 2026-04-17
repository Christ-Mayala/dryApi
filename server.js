require('dotenv').config();

const http = require('http');

const config = require('./config/database');
const { connectCluster } = require('./dry/config/connection/dbConnection');
const redisService = require('./dry/services/cache/redis.service');
const { startPurgeScheduler } = require('./dry/services/cleanup/purgeDeleted.scheduler');
const {
  startScimReservationReminderScheduler,
} = require('./dry/services/notification/scimReservationReminder.scheduler');
const {
  registerProcessHandlers,
  scheduleFatalExit,
  sendProcessAlert,
} = require('./dry/bootstrap/process-handlers');
const { createApp } = require('./dry/bootstrap/http');
const { registerApplicationRoutes } = require('./dry/bootstrap/routes');
const { createSocketServer } = require('./dry/bootstrap/socket');
const { startHealthMonitor } = require('./dry/bootstrap/health-monitor');
const { printStartupBanner } = require('./dry/bootstrap/startup-banner');

registerProcessHandlers();

const { app, allowedOrigins } = createApp();
registerApplicationRoutes(app);

const server = http.createServer(app);
createSocketServer(server, app, allowedOrigins);

const startServer = async () => {
  await connectCluster();
  await redisService.connect();

  startPurgeScheduler();
  startHealthMonitor();
  startScimReservationReminderScheduler();

  await new Promise((resolve) => {
    server.listen(config.PORT, async () => {
      await printStartupBanner(config.PORT, allowedOrigins);
      resolve();
    });
  });
};

startServer().catch(async (error) => {
  console.error('ECHEC AU DEMARRAGE DU SERVEUR :', error.message);
  scheduleFatalExit('startup');
  await sendProcessAlert('DRY_UNCAUGHT_EXCEPTION', error, {
    origin: 'startup',
    phase: 'bootstrap',
  });
});
