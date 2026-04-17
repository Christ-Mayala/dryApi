const redisService = require('../../services/cache/redis.service');

const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET' || !redisService.isConnected) {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redisService.get(key);
      if (cached) {
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.set(key, data, duration).catch((error) => {
            console.error('[CACHE] Erreur mise en cache:', error);
          });
        }
        return originalJson(data);
      };

      return next();
    } catch (error) {
      console.error('[CACHE] Erreur:', error);
      return next();
    }
  };
};

const invalidateCache = () => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (!redisService.isConnected || res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      try {
        await redisService.flush();
      } catch (error) {
        console.error('[CACHE] Erreur invalidation:', error);
      }
    });

    next();
  };
};

module.exports = { cache, invalidateCache };
