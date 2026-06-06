/**
 * Middleware de Monitoring Performance
 * Suit les temps de réponse, l'utilisation mémoire et les métriques par endpoint
 * @module dry/middleware/performanceMonitor.middleware
 */

const config = require('../../config/database');

/**
 * Store des métriques de performance en mémoire
 * Utilisé comme fallback si Prometheus n'est pas activé
 */
class PerformanceStore {
  constructor() {
    this.reset();
  }

  /**
   * Réinitialise toutes les métriques
   */
  reset() {
    this.store = {
      requests: new Map(),     // endpoint → { count, totalDuration, errors }
      memory: [],              // snapshots mémoire
      dbQueries: new Map(),    // collection → { count, totalDuration }
      startTime: Date.now(),
    };
  }

  /**
   * Enregistre une requête
   * @param {string} endpoint - Route appelée
   * @param {number} durationMs - Durée en ms
   * @param {number} statusCode - Code HTTP
   */
  recordRequest(endpoint, durationMs, statusCode) {
    const key = endpoint || 'unknown';
    if (!this.store.requests.has(key)) {
      this.store.requests.set(key, { count: 0, totalDuration: 0, errors: 0 });
    }

    const data = this.store.requests.get(key);
    data.count += 1;
    data.totalDuration += durationMs;
    if (statusCode >= 500) {
      data.errors += 1;
    }
  }

  /**
   * Enregistre un snapshot mémoire
   */
  recordMemory() {
    const memory = process.memoryUsage();
    this.store.memory.push({
      timestamp: Date.now(),
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
    });

    // Garder seulement les 100 derniers snapshots
    if (this.store.memory.length > 100) {
      this.store.memory.shift();
    }
  }

  /**
   * Enregistre une requête DB
   * @param {string} collection - Nom de la collection
   * @param {number} durationMs - Durée en ms
   */
  recordDbQuery(collection, durationMs) {
    const key = collection || 'unknown';
    if (!this.store.dbQueries.has(key)) {
      this.store.dbQueries.set(key, { count: 0, totalDuration: 0 });
    }

    const data = this.store.dbQueries.get(key);
    data.count += 1;
    data.totalDuration += durationMs;
  }

  /**
   * Calcule les statistiques aggrégées
   * @returns {object} Rapport de performance
   */
  getStats() {
    const uptimeSeconds = (Date.now() - this.store.startTime) / 1000;
    const totalRequests = Array.from(this.store.requests.values())
      .reduce((sum, r) => sum + r.count, 0);
    const totalErrors = Array.from(this.store.requests.values())
      .reduce((sum, r) => sum + r.errors, 0);

    // Endpoints lents (top 5 par durée moyenne)
    const slowEndpoints = Array.from(this.store.requests.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avgDuration: data.count > 0 ? (data.totalDuration / data.count).toFixed(2) : 0,
        errorRate: data.count > 0 ? ((data.errors / data.count) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    const lastMemory = this.store.memory[this.store.memory.length - 1] || {};

    return {
      uptime: {
        seconds: uptimeSeconds,
        human: this._formatDuration(uptimeSeconds),
      },
      requests: {
        total: totalRequests,
        errors: totalErrors,
        errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0,
        rps: uptimeSeconds > 0 ? (totalRequests / uptimeSeconds).toFixed(2) : 0,
      },
      memory: lastMemory.rss ? {
        rss: `${(lastMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(lastMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(lastMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      } : null,
      slowEndpoints,
    };
  }

  /**
   * Formate une durée en secondes en format lisible
   * @param {number} seconds - Durée en secondes
   * @returns {string} Durée formatée
   */
  _formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  }
}

// Instance singleton
const perfStore = new PerformanceStore();

// Enregistrer la mémoire toutes les 30 secondes
if (typeof setInterval !== 'undefined') {
  setInterval(() => perfStore.recordMemory(), 30000).unref();
}

/**
 * Middleware Express de monitoring de performance
 * Ajoute les métriques de temps de réponse et de mémoire
 *
 * @param {object} [options] - Options
 * @param {boolean} [options.logSlowRequests=true] - Logger les requêtes lentes
 * @param {number} [options.slowThreshold=5000] - Seuil de lenteur en ms
 * @returns {Function} Middleware Express
 */
const performanceMonitor = (options = {}) => {
  const {
    logSlowRequests = true,
    slowThreshold = 5000,
  } = options;

  return (req, res, next) => {
    const start = Date.now();
    const logger = req.app?.locals?.logger || console;

    // Capturer la fin de la requête
    res.on('finish', () => {
      const duration = Date.now() - start;
      const endpoint = `${req.method} ${req.originalUrl}`;

      perfStore.recordRequest(endpoint, duration, res.statusCode);

      // Logger les requêtes lentes
      if (logSlowRequests && duration > slowThreshold) {
        logger.warn(`Requête lente détectée: ${endpoint} (${duration}ms)`);
      }
    });

    next();
  };
};

module.exports = {
  performanceMonitor,
  perfStore,
  PerformanceStore,
};
