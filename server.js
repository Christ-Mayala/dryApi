require('dotenv').config();

// Le DNS du réseau local ne relaie pas les enregistrements SRV (requis par mongodb+srv://),
// alors qu'un résolveur public le fait sans problème → on force Node à l'utiliser pour Atlas.
if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://')) {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
}

const http = require('http');

const config = require('./config/database');
const { connectCluster } = require('./dry/config/connection/dbConnection');
const redisService = require('./dry/services/cache/redis.service');
const { startPurgeScheduler } = require('./dry/services/cleanup/purgeDeleted.scheduler');
const {
  startDataRetentionScheduler,
} = require('./dry/services/cleanup/dataRetention.scheduler');
const {
  startScimReservationReminderScheduler,
} = require('./dry/services/notification/scimReservationReminder.scheduler');
const {
  startScimBonPlanExpiryScheduler,
} = require('./dry/services/cleanup/scimBonPlanExpiry.scheduler');
const {
  startScimPdfFallbackScheduler,
} = require('./dry/services/notification/scimPdfFallback.scheduler');
const {
  startPodcastRssScheduler,
  PODCAST_APP,
} = require('./dryApp/Pelerin/services/podcastRss.scheduler');
const {
  startHousePreachingSyncScheduler,
} = require('./dryApp/Pelerin/services/housePreachingSync.scheduler');
const {
  startYoutubeAudioScheduler,
} = require('./dryApp/Pelerin/services/youtubeAudio.scheduler');
const {
  seedDefaultPodcasts,
} = require('./dryApp/Pelerin/services/podcastSeed.service');
const {
  loadScoringOverrides,
} = require('./dryApp/Pelerin/services/podcastScoring.service');
const getModel = require('./dry/core/factories/modelFactory');
const PodcastShowSchema = require('./dryApp/Pelerin/features/podcastShow/model/podcastShow.schema');
const PodcastEpisodeSchema = require('./dryApp/Pelerin/features/podcastEpisode/model/podcastEpisode.schema');
const PodcastScoringConfigSchema = require('./dryApp/Pelerin/features/podcastShow/model/podcastScoringConfig.schema');
const {
  registerProcessHandlers,
  scheduleFatalExit,
  sendProcessAlert,
} = require('./dry/bootstrap/process-handlers');
const { createApp } = require('./dry/bootstrap/http');
const { registerApplicationRoutes } = require('./dry/bootstrap/routes');
const { createSocketServer } = require('./dry/bootstrap/socket');
const { initAdminSocket } = require('./dryApp/Trivida/features/admin/services/adminSocket.service');
const { startMetricsCron } = require('./dryApp/Trivida/features/admin/cron/adminMetricsCron');
const { startHealthMonitor } = require('./dry/bootstrap/health-monitor');
const { printStartupBanner } = require('./dry/bootstrap/startup-banner');

registerProcessHandlers();

const { app, allowedOrigins } = createApp();

const server = http.createServer(app);
createSocketServer(server, app, allowedOrigins);
// Socket.IO admin panel (notifications temps réel)
initAdminSocket(server);

const startServer = async () => {
  await connectCluster();
  await redisService.connect();
  await registerApplicationRoutes(app);

  startPurgeScheduler();
  startDataRetentionScheduler();
  startHealthMonitor();
  startScimReservationReminderScheduler();
  startScimBonPlanExpiryScheduler();
  startScimPdfFallbackScheduler();

  // Surcharges de scoring persistées par l'admin (priorité sur le .env) :
  // les charge au démarrage pour que le pipeline les applique dès le 1er run.
  try {
    const ScoringConfig = getModel(PODCAST_APP, 'PodcastScoringConfig', PodcastScoringConfigSchema);
    await loadScoringOverrides(ScoringConfig);
  } catch (err) {
    console.warn('[PODCAST] ⚠️  Surcharges de scoring non chargées :', err.message);
  }

  startPodcastRssScheduler();
  startHousePreachingSyncScheduler();
  startYoutubeAudioScheduler();
  
  // Cron job : snapshots métriques quotidiennes Trivida (minuit)
  startMetricsCron();

  // Seed : podcasts francophones par défaut (une seule fois, si catalogue vide).
  // NOTE : tenant fixe PODCAST_APP ('Pelerin') — le bootloader monte les routes
  // sur le nom du dossier dryApp/Pelerin, PAS sur process.env.APP_NAME.
  if (process.env.PODCAST_SEED_ENABLED !== 'false' && process.env.NODE_ENV !== 'test') {
    const appName = PODCAST_APP;
    const Show = getModel(appName, 'PodcastShow', PodcastShowSchema);
    const Episode = getModel(appName, 'PodcastEpisode', PodcastEpisodeSchema);
    const seed = await seedDefaultPodcasts({ Show, Episode });
    if (!seed.skipped) {
      console.log(`[PODCAST-SEED] 🌱 ${seed.seeded} podcast(s) importé(s) par défaut` + (seed.errors.length ? ` (${seed.errors.length} en échec)` : ''));
    }
  }

  await new Promise((resolve) => {
    server.listen(config.PORT, '0.0.0.0', async () => {
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
