const rateLimit = require('express-rate-limit');

// Limiteur spécifique pour les routes d'authentification (login/register).
// Objectif : limiter les tentatives de brute-force tout en laissant le reste de l'API
// utiliser un quota plus large (voir security.middleware.js).

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives max par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
  },
});

module.exports = authLimiter;
