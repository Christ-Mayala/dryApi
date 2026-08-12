const express = require('express');
const mongoose = require('mongoose');
const AlertSchema = require('../models/alert/Alert.schema');
const config = require('../../config/database');
const { sendAlert } = require('../services/alert/alert.service');

const AlertModel = mongoose.connection ? mongoose.connection.model('Alert', AlertSchema) : null;

const router = express.Router();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const getAlertModel = () => {
  if (!AlertModel) {
    if (!mongoose.connection) throw new Error('Connexion MongoDB non disponible');
    return mongoose.connection.model('Alert', AlertSchema);
  }
  return AlertModel;
};

const maintenanceModeKey = 'alerts:maintenanceMode';

const getMaintenanceMode = async () => {
  try {
    const redis = require('../services/cache/redis.service');
    const val = await redis.get(maintenanceModeKey);
    return val === '1' || val === 'true';
  } catch {
    return parseBoolean(config.ALERT_MAINTENANCE_MODE, false);
  }
};

const setMaintenanceMode = async (value) => {
  try {
    const redis = require('../services/cache/redis.service');
    await redis.set(maintenanceModeKey, value ? '1' : '0', 'EX', 86400);
  } catch {
    config.ALERT_MAINTENANCE_MODE = value ? 'true' : 'false';
  }
};

router.get('/', async (req, res) => {
  try {
    const Alert = getAlertModel();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const severity = req.query.severity;
    const acknowledged = req.query.acknowledged;
    const search = req.query.search;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filter = {};
    if (severity && ['critical', 'warning', 'info'].includes(severity)) {
      filter.severity = severity;
    }
    if (acknowledged !== undefined) {
      filter.acknowledged = parseBoolean(acknowledged, false);
    }
    if (search) {
      filter["$or"] = [
        { message: { $regex: search, $options: "i" } },
        { event: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp["$gte"] = new Date(startDate);
      if (endDate) filter.timestamp["$lte"] = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      Alert.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Alert.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/acknowledge', async (req, res) => {
  try {
    const Alert = getAlertModel();
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alerte introuvable' });

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = req.user?.id || req.body.acknowledgedBy || 'system';
    await alert.save();

    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const enabled = parseBoolean(req.body.enabled, false);
    await setMaintenanceMode(enabled);
    res.json({ success: true, maintenanceMode: enabled });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/maintenance', async (req, res) => {
  try {
    const mode = await getMaintenanceMode();
    res.json({ success: true, maintenanceMode: mode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const severity = String(req.body.severity || 'critical').toLowerCase();
    const message = String(req.body.message || 'Alerte de test depuis Le Pèlerin');
    
    const result = await sendAlert({
      event: 'TEST_ALERT',
      message,
      status: 'TEST',
      timestamp: new Date().toISOString(),
      details: {
        app: 'Le Pèlerin',
        env: config.NODE_ENV || 'development',
        source: 'admin-test-route',
      },
    }, severity);

  res.json({
    success: true,
    severity,
    message: 'Alerte de test envoyée',
    delivery: {
      email: result.email,
      telegram: result.telegram,
      whatsapp: result.whatsapp,
      webhook: result.webhook,
    },
    skipped: result.skipped,
    reason: result.reason || (result.skipped ? 'unknown' : null),
  });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/telegram-test', async (req, res) => {
  try {
    const telegramBotToken = String(config.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');
    const telegramChatId = String(config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '');
    
    if (!telegramBotToken || !telegramChatId) {
      return res.status(400).json({ 
        success: false, 
        message: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant dans .env',
        token: !!telegramBotToken,
        chat: !!telegramChatId
      });
    }

    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: 'Test de diagnostic depuis Le Pèlerin. Si tu reçois ce message, Telegram fonctionne !',
      }),
    });

    const data = await response.json().catch(() => null);
    
    res.json({
      success: response.ok && data?.ok,
      status: response.status,
      telegramResponse: data,
      chatId: telegramChatId,
      botToken: telegramBotToken.slice(0, 10) + '...'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
