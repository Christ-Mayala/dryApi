const asyncHandler = require('express-async-handler');
const cron = require('node-cron');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getScoringConfig, loadScoringOverrides } = require('../../../services/podcastScoring.service');
const { getDiscoveryKeywords, PODCAST_APP } = require('../../../services/podcastRss.scheduler');
const { getApiBase } = require('../../../services/podcastIndex.service');
const PodcastScoringConfigSchema = require('../model/podcastScoringConfig.schema');

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseIntSafe = (value, fallback) => {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isNaN(n) ? fallback : n;
};

// GET /podcastShow/admin/config — admin. État réel de la configuration du
// module Podcast : credentials Podcast Index (présents ou non), schedulers
// (activés + expression cron + validité), seed au démarrage, mots-clés de
// découverte et scoring en vigueur (seuils + poids par critère).
module.exports = asyncHandler(async (req, res) => {
  // Rafraîchit le cache des surcharges persistées (un autre admin / process a
  // pu modifier le scoring entre-temps).
  const ConfigModel = req.getModel('PodcastScoringConfig', PodcastScoringConfigSchema);
  await loadScoringOverrides(ConfigModel);

  const rssExpression = process.env.PODCAST_RSS_CRON || '0 * * * *';
  const discoverExpression = process.env.PODCAST_AUTO_DISCOVER_CRON || '0 4 * * *';
  const rssSyncEnabled = parseBool(process.env.PODCAST_RSS_SYNC_ENABLED, true);
  const autoDiscoverEnabled = parseBool(process.env.PODCAST_AUTO_DISCOVER_ENABLED, true);
  const seedEnabled = process.env.PODCAST_SEED_ENABLED !== 'false';

  const config = {
    appName: PODCAST_APP,
    podcastIndex: {
      configured: Boolean(
        process.env.PODCASTINDEX_API_KEY && process.env.PODCASTINDEX_API_SECRET,
      ),
      apiBase: getApiBase(),
    },
    schedulers: {
      rssSync: {
        enabled: rssSyncEnabled,
        cron: rssExpression,
        cronValid: cron.validate(rssExpression),
      },
      autoDiscover: {
        enabled: autoDiscoverEnabled,
        cron: discoverExpression,
        cronValid: cron.validate(discoverExpression),
        maxPerRun: parseIntSafe(process.env.PODCAST_AUTO_DISCOVER_MAX, 8),
      },
    },
    seedEnabled,
    discovery: {
      keywords: getDiscoveryKeywords(),
    },
    scoring: getScoringConfig(),
  };

  return sendResponse(res, config, 'Configuration Podcast récupérée');
});
