/**
 * Routes Analytics — Trivida
 * 
 * Base URL: /api/v1/trivida/analytics/
 */
const express = require('express');
const router = express.Router();

const {
  trackEvents,
  getFunnel,
  getRetention,
  getEvents,
  getBusinessMetrics,
} = require('../controller/analytics.controller');

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

// Routes authentifiées
router.post('/events', protect, withAudit('ANALYTICS_TRACK'), trackEvents);
router.get('/funnel', protect, withAudit('ANALYTICS_FUNNEL'), getFunnel);
router.get('/retention', protect, withAudit('ANALYTICS_RETENTION'), getRetention);
router.get('/events', protect, withAudit('ANALYTICS_EVENTS'), getEvents);
router.get('/business', protect, withAudit('ANALYTICS_BUSINESS'), getBusinessMetrics);

module.exports = router;
