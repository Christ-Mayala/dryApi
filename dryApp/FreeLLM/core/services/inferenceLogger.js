
/**
 * @fileoverview Système de logging et profiling centralisé pour InferenceOS
 * Production-ready, avec catégorisation des logs et profiling déterministe
 */

const crypto = require('crypto');

/**
 * @typedef {Object} Profiler
 * @property {number} start - Timestamp de début
 * @property {Object<string, number>} marks - Timestamps des marks
 * @property {function(string): void} mark - Enregistrer un mark
 * @property {function(string, string): number} diff - Calculer la différence entre deux marks
 * @property {function(): Object} summary - Générer le résumé final
 */

/**
 * Crée un nouveau profiler pour une requête
 * @returns {Profiler}
 */
function createProfiler() {
  return {
    start: Date.now(),
    marks: {},
    
    /**
     * Enregistre un timestamp avec un nom
     * @param {string} name - Nom du mark
     */
    mark(name) {
      this.marks[name] = Date.now();
    },
    
    /**
     * Calcule la différence entre deux marks (en ms)
     * @param {string} from - Mark de départ
     * @param {string} to - Mark de fin
     * @returns {number}
     */
    diff(from, to) {
      const fromTime = this.marks[from] || this.start;
      const toTime = this.marks[to] || Date.now();
      return Math.max(0, toTime - fromTime);
    },
    
    /**
     * Génère un résumé structuré et complet (jamais undefined)
     * @returns {Object}
     */
    summary() {
      const now = Date.now();
      return {
        auth: this.diff('start', 'auth'),
        context: this.diff('auth', 'context'),
        routing: this.diff('context', 'routing'),
        provider: this.diff('provider', 'providerEnd'),
        mongoSave: this.diff('providerEnd', 'mongo'),
        serialization: this.diff('mongo', 'serialize'),
        total: now - this.start
      };
    }
  };
}

/**
 * Catégories de logs
 */
const LOG_LEVELS = {
  REQUEST: 'REQUEST',
  EVENT: 'EVENT',
  DEBUG: 'DEBUG',
  ERROR: 'ERROR'
};

const classicLogger = require('../../../../dry/utils/logging/logger');
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Logger centralisé
 */
const logger = {
  /**
   * Log final de requête (UN SEUL PAR REQUÊTE)
   */
  request(data) {
    if (IS_PROD) {
      const statusStr = data.status === 'success' ? 'OK' : 'FAIL';
      const duration = data.performance?.total || 0;
      const msg = `[REQ-FINAL] [${data.requestId}] ${data.platform || 'unknown'}:${data.model || 'unknown'} ${statusStr} ${duration}ms`;
      classicLogger(msg, data.status === 'success' ? 'success' : 'error');
    } else {
      console.log(JSON.stringify({
        level: LOG_LEVELS.REQUEST,
        message: '[REQ-FINAL]',
        timestamp: new Date().toISOString(),
        ...data
      }));
    }
  },

  /**
   * Log d'événement (fallback, retry, cooldown, etc.)
   */
  event(message, data) {
    if (!IS_PROD) {
      console.log(JSON.stringify({
        level: LOG_LEVELS.EVENT,
        message: message,
        timestamp: new Date().toISOString(),
        ...data
      }));
    }
  },

  /**
   * Log de debug (détails internes, KeyPoolManager, etc.)
   */
  debug(message, data) {
    if (!IS_PROD) {
      console.log(JSON.stringify({
        level: LOG_LEVELS.DEBUG,
        message: message,
        timestamp: new Date().toISOString(),
        ...data
      }));
    }
  },

  /**
   * Log d'erreur
   */
  error(message, data) {
    if (IS_PROD) {
      const msg = `[${data?.requestId || 'unknown'}] ${message} ${data ? JSON.stringify(data) : ''}`;
      classicLogger(msg, 'error');
    } else {
      console.error(JSON.stringify({
        level: LOG_LEVELS.ERROR,
        message: message,
        timestamp: new Date().toISOString(),
        ...data
      }));
    }
  }
};

/**
 * Gestionnaire de circuit breaker au niveau provider
 */
class ProviderCircuitBreaker {
  constructor() {
    this.state = new Map();
    this.FAILURE_THRESHOLD = 5;
    this.COOLDOWN_MS = 30000; // 30 secondes
  }

  /**
   * Vérifie si un provider est disponible
   * @param {string} provider - Nom du provider
   * @returns {boolean}
   */
  isAvailable(provider) {
    const state = this.state.get(provider);
    if (!state) return true;

    if (state.blockedUntil && Date.now() < state.blockedUntil) {
      return false;
    }

    return true;
  }

  /**
   * Enregistre un succès
   * @param {string} provider - Nom du provider
   */
  recordSuccess(provider) {
    const state = this.state.get(provider) || {
      failures: 0,
      blockedUntil: null,
      lastFailure: null
    };
    state.failures = Math.max(0, state.failures - 1);
    this.state.set(provider, state);
  }

  /**
   * Enregistre un échec
   * @param {string} provider - Nom du provider
   */
  recordFailure(provider) {
    const state = this.state.get(provider) || {
      failures: 0,
      blockedUntil: null,
      lastFailure: null
    };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.FAILURE_THRESHOLD) {
      state.blockedUntil = Date.now() + this.COOLDOWN_MS;
      logger.event('CIRCUIT_BREAKER_OPEN', {
        provider,
        failures: state.failures,
        blockedUntil: state.blockedUntil
      });
    }

    this.state.set(provider, state);
  }

  /**
   * Récupère l'état d'un provider
   * @param {string} provider - Nom du provider
   * @returns {Object}
   */
  getState(provider) {
    return this.state.get(provider) || { failures: 0, blockedUntil: null, lastFailure: null };
  }
}

const circuitBreaker = new ProviderCircuitBreaker();

module.exports = {
  createProfiler,
  logger,
  circuitBreaker,
  LOG_LEVELS
};
