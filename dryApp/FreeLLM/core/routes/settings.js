const express = require('express');
const crypto = require('crypto');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;

function createSettingsRouter(SettingsModel) {
  const router = express.Router();
  router.use(protect);
  router.get('/api-key', async (req, res) => {
    const doc = await SettingsModel.findOne({ key: 'unified_api_key', deletedAt: null }).lean();
    let apiKey;
    if (!doc) {
      apiKey = crypto.randomBytes(32).toString('hex');
      const newDoc = new SettingsModel({
        key: 'unified_api_key',
        value: apiKey,
        label: 'Unified API Key'
      });
      await newDoc.save();
    } else {
      apiKey = doc.value;
    }
    res.json({ apiKey });
  });

  router.post('/api-key/regenerate', async (req, res) => {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const doc = await SettingsModel.findOneAndUpdate(
      { key: 'unified_api_key', deletedAt: null },
      { $set: { value: apiKey } },
      { new: true, upsert: true }
    );
    res.json({ apiKey });
  });
  
  return router;
}

module.exports = { createSettingsRouter };
