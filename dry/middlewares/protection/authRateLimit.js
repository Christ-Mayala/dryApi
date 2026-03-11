const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const config = require('../../../config/database');

// Limiteur specifique pour les routes d'authentification (login/register).
// En production, on durcit encore plus pour limiter le brute-force.
const isProd = config.NODE_ENV === 'production';

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProd ? 5 : 15, // plus strict en prod
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown-ip';
        return ipKeyGenerator(ip);
    },
    message: {
        success: false,
        message: 'Trop de tentatives de connexion, veuillez reessayer plus tard.',
    },
});

module.exports = authLimiter;
