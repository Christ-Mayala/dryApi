/**
 * Rate limiting dédié au programme de parrainage Trivida.
 *
 * Stratégie (audit sécurité du 12/09/2026) :
 *   - validateLimiter  : SOUPLE — borne les consultations publiques GET /validate
 *                        (scan/saisie abusive de codes) sans bloquer les vrais clics.
 *   - claimLimiter     : STRICT  — borne les réclamations POST /claim (et l'alias
 *                        POST /validate). Le claim est l'endpoint qui accorde des
 *                        requêtes IA : un abuse limité ici. N'est PAS la seule
 *                        protection (l'idempotence se fait au niveau base).
 *
 * Pattern réutilisé : dry/middlewares/protection/authRateLimit.js (express-rate-limit).
 */
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const config = require('../../../../../config/database');

const baseMessage = (message) => ({
  success: false,
  message,
});

const validateLimiter = rateLimit({
  windowMs: config.REFERRAL.rateLimit.validate.windowMs,
  max: config.REFERRAL.rateLimit.validate.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown-ip';
    return ipKeyGenerator(ip);
  },
  message: baseMessage('Trop de vérifications de code, veuillez reessayer plus tard.'),
});

const claimLimiter = rateLimit({
  windowMs: config.REFERRAL.rateLimit.claim.windowMs,
  max: config.REFERRAL.rateLimit.claim.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Authentifié : on cible le compte (plus précis que l'IP derrière NAT).
    if (req.user && req.user._id) return ipKeyGenerator(`user:${req.user._id}`);
    const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown-ip';
    return ipKeyGenerator(ip);
  },
  message: baseMessage('Trop de codes utilises, veuillez reessayer plus tard.'),
});

module.exports = { validateLimiter, claimLimiter };