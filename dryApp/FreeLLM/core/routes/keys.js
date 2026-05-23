const express = require('express');
const { encrypt, decrypt, maskKey } = require('../lib/crypto');
const { getProvider, getAllProviders } = require('../providers/index');
const router = express.Router();

const PLATFORMS = [
  'google', 'groq', 'cerebras', 'sambanova', 'nvidia', 'mistral',
  'openrouter', 'github', 'cohere', 'cloudflare', 'zhipu', 'ollama',
  'kilo', 'pollinations', 'llm7', 'openai',
];

function createKeysRouter(ApiKeysModel) {
  router.get('/', async (req, res) => {
    const rows = await ApiKeysModel.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();

    const keys = [];
    for (const row of rows) {
      let maskedKey = '****';
      try {
        if (!row.encryptedKey || !row.iv || !row.authTag) {
          continue;
        }
        const realKey = decrypt(row.encryptedKey, row.iv, row.authTag);
        maskedKey = maskKey(realKey);
      } catch {
        continue;
      }
      keys.push({
        id: row._id,
        platform: row.platform,
        label: row.label,
        maskedKey,
        status: row.status,
        enabled: row.enabled,
        createdAt: row.createdAt,
        lastCheckedAt: row.lastCheckedAt,
      });
    }

    res.json(keys);
  });

  router.post('/', async (req, res) => {
    const { platform, key, label } = req.body;

    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: { message: 'Invalid platform' } });
    }

    const { encrypted, iv, authTag } = encrypt(key);

    const doc = new ApiKeysModel({
      platform,
      label: label || 'Key ' + Date.now(),
      encryptedKey: encrypted,
      iv,
      authTag,
      status: 'unknown',
      enabled: true,
    });

    await doc.save();

    res.status(201).json({
      id: doc._id,
      platform,
      label: label || '',
      maskedKey: maskKey(key),
      status: 'unknown',
      enabled: true,
    });
  });

  router.delete('/:id', async (req, res) => {
    const doc = await ApiKeysModel.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: { message: 'Key not found' } });
    }

    res.json({ success: true });
  });

  router.patch('/:id', async (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: { message: 'enabled must be a boolean' } });
    }

    const doc = await ApiKeysModel.findByIdAndUpdate(
      req.params.id,
      { enabled },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: { message: 'Key not found' } });
    }

    res.json({ success: true, enabled: doc.enabled });
  });

  return router;
}

module.exports = { createKeysRouter, PLATFORMS };
