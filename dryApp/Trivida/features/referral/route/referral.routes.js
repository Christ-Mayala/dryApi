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
  getReferralInfo,
  claimReferral,
} = require('../controller/referral.controller');

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { validateLimiter, claimLimiter } = require('../middleware/referralRateLimit');

// Public : lien de parrainage partagé (GET ?code=XXX, sans auth).
// STRICTEMENT informatif (aucune attribution) — limité (souple) contre le scan de codes.
router.get('/validate', validateLimiter, getReferralInfo);

// Routes authentifiées
router.get('/code', protect, withAudit('REFERRAL_GET_CODE'), getMyCode);
router.get('/stats', protect, withAudit('REFERRAL_GET_STATS'), getStats);

// Réclamation sécurisée (endpoint de référence) : strictement limitée.
router.post('/claim', protect, claimLimiter, withAudit('REFERRAL_CLAIM'), claimReferral);

// Alias idempotent de /claim, conservé pour compatibilité du frontend
// existant (RegisterScreen / ReferralContext). Mêmes garde-fous que /claim.
router.post('/validate', protect, claimLimiter, withAudit('REFERRAL_VALIDATE'), validateCode);

// Activation de la récompense du parrain (idempotent, accès réservé au parrain).
router.post('/reward', protect, claimLimiter, withAudit('REFERRAL_REWARD'), activateReward);

module.exports = router;
