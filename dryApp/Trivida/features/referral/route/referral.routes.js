/**
 * Routes Referral — Programme de parrainage Trivida
 *
 * Base URL: /api/v1/trivida/referral/
 */
const express = require('express');
const router = express.Router();

const {
  getMyCode,
  getStats,
  validateCode,
  activateReward,
} = require('../controller/referral.controller');

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

// Routes authentifiées
router.get('/code', protect, withAudit('REFERRAL_GET_CODE'), getMyCode);
router.get('/stats', protect, withAudit('REFERRAL_GET_STATS'), getStats);
router.post('/validate', protect, withAudit('REFERRAL_VALIDATE'), validateCode);
router.post('/reward', protect, withAudit('REFERRAL_REWARD'), activateReward);

module.exports = router;
