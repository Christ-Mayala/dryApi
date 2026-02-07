const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const enabledFlag = (process.env.REDIS_ENABLED || '').toLowerCase();
      const hasUrl = !!process.env.REDIS_URL;
      if (enabledFlag === 'false' || (!hasUrl && enabledFlag !== 'true')) {
        console.log('[REDIS] Desactive (REDIS_ENABLED=false ou REDIS_URL manquant)');
        this.isConnected = false;
        return false;
      }

      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.log('[REDIS] Serveur Redis non disponible, cache désactivé');
            return false;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        console.error('[REDIS] Erreur:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[REDIS] ✅ Connecté');
        this.isConnected = true;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.warn('[REDIS] ⚠️ Cache non disponible:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[REDIS] Erreur GET:', error);
      return null;
    }
  }

  async set(key, value, duration = 300) {
    if (!this.isConnected) return false;
    try {
      await this.client.setEx(key, duration, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[REDIS] Erreur SET:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[REDIS] Erreur DEL:', error);
      return false;
    }
  }

  async flush() {
    if (!this.isConnected) return false;
    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      console.error('[REDIS] Erreur FLUSH:', error);
      return false;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    };
  }
}

module.exports = new RedisService();
