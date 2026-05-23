const express = require('express');
const router = express.Router();
const { hasProvider } = require('../providers');
const { checkKeyHealth, checkAllKeys } = require('../services/health');

function createHealthRouter(ModelsModel, ApiKeysModel) {
  router.get('/', async (req, res) => {
    const keys = await ApiKeysModel.find({ deletedAt: null }).sort({ platform: 1, createdAt: -1 }).lean();
    const platforms = {};
    for (const k of keys) {
      if (!platforms[k.platform]) {
        platforms[k.platform] = {
          platform: k.platform,
          hasProvider: hasProvider(k.platform),
          totalKeys: 0,
          healthyKeys: 0,
          rateLimitedKeys: 0,
          invalidKeys: 0,
          errorKeys: 0,
          unknownKeys: 0,
          enabledKeys: 0
        };
      }
      platforms[k.platform].totalKeys++;
      const status = k.status || 'unknown';
      if (status === 'healthy') platforms[k.platform].healthyKeys++;
      else if (status === 'rate_limited') platforms[k.platform].rateLimitedKeys++;
      else if (status === 'invalid') platforms[k.platform].invalidKeys++;
      else if (status === 'error') platforms[k.platform].errorKeys++;
      else platforms[k.platform].unknownKeys++;
      if (k.enabled) platforms[k.platform].enabledKeys++;
    }

    res.json({
      platforms: Object.values(platforms),
      keys: keys.map(k => ({
        id: k._id,
        platform: k.platform,
        label: k.label,
        status: k.status || 'unknown',
        enabled: k.enabled,
        createdAt: k.createdAt,
        lastCheckedAt: k.lastCheckedAt
      }))
    });
  });

  router.post('/check/:keyId', async (req, res) => {
    const keyId = req.params.keyId;
    const status = await checkKeyHealth(keyId, ApiKeysModel);
    res.json({ keyId, status });
  });

  router.post('/check-all', async (req, res) => {
    await checkAllKeys(ApiKeysModel);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createHealthRouter };
