/**
 * Rate Limiter Amélioré
 * Rate limiting par utilisateur avec Redis, fenêtre glissante et limites par rôle
 * @module dry/middlewares/rateLimiterEnhanced.middleware
 */

const config = require('../../config/database');
const redisService = require('../services/cache/redis.service');

/**
 * Configuration des limites par rôle
 */
const ROLE_LIMITS = {
  public: {
    windowMs: 60 * 60 * 1000,  // 1 heure
    max: 100,
    description: 'Public',
  },
  authenticated: {
    windowMs: 60 * 60 * 1000,  // 1 heure
    max: 1000,
    description: 'Authentifié',
  },
  admin: {
    windowMs: 60 * 60 * 1000,  // 1 heure
    max: 10000,
    description: 'Administrateur',
  },
};

/**
 * Détermine le rôle et les limites pour une requête
 * @param {object} req - Requête Express
 * @returns {object} Limites applicables
 */
const getLimitsForRequest = (req) => {
  if (req.user && req.user.role === 'admin') return ROLE_LIMITS.admin;
  if (req.user) return ROLE_LIMITS.authenticated;
  return ROLE_LIMITS.public;
};

/**
 * Génère une clé Redis pour le rate limiting
 * @param {object} req - Requête Express
 * @returns {string} Clé Redis
 */
const getRateLimitKey = (req) => {
  const limits = getLimitsForRequest(req);
  const identifier = req.user
    ? `user:${req.user._id || req.user.id}`
    : `ip:${req.ip}`;
  const windowKey = Math.floor(Date.now() / limits.windowMs);
  return `ratelimit:${identifier}:${windowKey}`;
};

/**
 * Middleware de rate limiting avec Redis (fenêtre glissante)
 * Fallback vers le rate limiter natif Express si Redis est indisponible
 */
const rateLimiterEnhanced = () => {
  return async (req, res, next) => {
    try {
      // Ignorer les health checks
      if (req.path && req.path.startsWith('/health/')) {
        return next();
      }

      const limits = getLimitsForRequest(req);
      const key = getRateLimitKey(req);

      // Essayer Redis d'abord (utilise l'API existante du service Redis)
      if (redisService.isConnected) {
        const entry = await redisService.get(key);
        const current = entry ? entry.count + 1 : 1;
        
        // Stocker le compteur avec TTL
        await redisService.set(key, { count: current }, Math.ceil(limits.windowMs / 1000));

        // Ajouter les headers de rate limiting
        const remaining = Math.max(0, limits.max - current);
        const resetTime = Math.ceil((Date.now() + limits.windowMs) / 1000);

        res.setHeader('X-RateLimit-Limit', limits.max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime);
        res.setHeader('X-RateLimit-Role', limits.description);

        if (current > limits.max) {
          return res.status(429).json({
            success: false,
            message: `Trop de requêtes. Limite: ${limits.max} requêtes par ${limits.windowMs / 60000} minutes.`,
            retryAfter: Math.ceil(limits.windowMs / 1000),
            limit: limits.max,
            remaining: 0,
            reset: resetTime,
          });
        }
      }
      // Sinon utiliser le compteur en mémoire
      else {
        const memoryKey = `ratelimit:memory:${key}`;
        if (!global.__rateLimitStore) {
          global.__rateLimitStore = new Map();
        }
        const store = global.__rateLimitStore;
        const now = Date.now();

        // Nettoyer les entrées expirées
        for (const [k, v] of store) {
          if (v.expiresAt < now) store.delete(k);
        }

        const entry = store.get(memoryKey);
        const count = entry ? entry.count + 1 : 1;
        const expiresAt = now + limits.windowMs;

        store.set(memoryKey, { count, expiresAt });

        const remaining = Math.max(0, limits.max - count);
        const resetTime = Math.ceil(expiresAt / 1000);

        res.setHeader('X-RateLimit-Limit', limits.max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime);

        if (count > limits.max) {
          return res.status(429).json({
            success: false,
            message: `Trop de requêtes. Limite: ${limits.max} requêtes par ${limits.windowMs / 60000} minutes.`,
            retryAfter: Math.ceil(limits.windowMs / 1000),
          });
        }
      }

      next();
    } catch (error) {
      // En cas d'erreur, laisser passer (fail open)
      console.error('[RateLimiter] Erreur:', error.message);
      next();
    }
  };
};

module.exports = {
  rateLimiterEnhanced,
  ROLE_LIMITS,
};
