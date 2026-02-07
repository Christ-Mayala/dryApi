const redisService = require('../../services/cache/redis.service');

const cache = (duration = 300) => {
  return async (req, res, next) => {
    // Désactiver temporairement le cache pour éviter les erreurs Redis
    // TODO: Réactiver quand Redis sera corrigé
    return next();
    
    // Ne mettre en cache que les requêtes GET
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    try {
      // Vérifier si la réponse est en cache
      const cached = await redisService.get(key);
      if (cached) {
        return res.json(cached);
      }

      // Intercepter la méthode res.json pour mettre en cache la réponse
      const originalJson = res.json;
      res.json = function(data) {
        // Mettre en cache uniquement les réponses réussies
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.set(key, data, duration).catch(err => {
            console.error('[CACHE] Erreur mise en cache:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('[CACHE] Erreur:', error);
      next();
    }
  };
};

// Middleware pour invalider le cache
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    // Invalider le cache après les opérations d'écriture
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Supprimer les clés qui correspondent au pattern
          // Note: Redis n'a pas de pattern matching direct pour les clés, 
          // donc on invalide tout le cache de l'application
          await redisService.flush();
        } catch (error) {
          console.error('[CACHE] Erreur invalidation:', error);
        }
      }
    });
    next();
  };
};

module.exports = { cache, invalidateCache };
