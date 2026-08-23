/**
 * Circuit Breaker — Production-grade circuit breaker.
 *
 * États : CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * Caractéristiques :
 * - Seuils configurables par provider
 * - Exponential recovery (cooldown augmente à chaque ouverture)
 * - Half-open probes avec détection de récupération
 * - No-op si déjà dans le même état (pas de double-doublage)
 *
 * backward-compat : ancien API (getCircuitBreaker, getAllCircuitBreakers, etc.)
 * est conservée en bas de fichier.
 */

const { logger } = require('./inferenceLogger');

const CIRCUIT_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open',
};

const DEFAULT_OPTIONS = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
  maxRecoveryTimeoutMs: 300_000,
  halfOpenMaxProbes: 1,
  successThreshold: 3,
};

class CircuitBreaker {
  constructor(key, options = {}) {
    this.key = key;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenProbes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.lastStateChange = Date.now();
    this.openCount = 0;
    this.currentRecoveryTimeout = this.options.recoveryTimeoutMs;
  }

  canCall() {
    const now = Date.now();
    if (this.state === CIRCUIT_STATES.CLOSED) return true;
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (now - this.lastFailureTime >= this.currentRecoveryTimeout) {
        this._transitionTo(CIRCUIT_STATES.HALF_OPEN);
        return true;
      }
      return false;
    }
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      return this.halfOpenProbes < this.options.halfOpenMaxProbes;
    }
    return false;
  }

  recordSuccess() {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.halfOpenProbes++;
      if (this.successCount >= this.options.successThreshold) {
        this._transitionTo(CIRCUIT_STATES.CLOSED);
        this.failureCount = 0;
        this.currentRecoveryTimeout = this.options.recoveryTimeoutMs;
      }
    }
    if (this.state === CIRCUIT_STATES.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CIRCUIT_STATES.CLOSED && this.failureCount >= this.options.failureThreshold) {
      this._transitionTo(CIRCUIT_STATES.OPEN);
    } else if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this._transitionTo(CIRCUIT_STATES.OPEN);
    }
  }

  _transitionTo(newState) {
    if (this.state === newState) return; // No-op
    this.state = newState;
    this.lastStateChange = Date.now();
    if (newState === CIRCUIT_STATES.OPEN) {
      this.openCount++;
      this.halfOpenProbes = 0;
      this.successCount = 0;
      this.currentRecoveryTimeout = Math.min(
        this.currentRecoveryTimeout * 2, this.options.maxRecoveryTimeoutMs
      );
      logger.event('CIRCUIT_BREAKER_OPEN', {
        provider: this.key, failureCount: this.failureCount,
        openCount: this.openCount, recoveryTimeoutMs: this.currentRecoveryTimeout,
      });
    } else if (newState === CIRCUIT_STATES.CLOSED) {
      logger.event('CIRCUIT_BREAKER_CLOSED', { provider: this.key });
    } else if (newState === CIRCUIT_STATES.HALF_OPEN) {
      logger.event('CIRCUIT_BREAKER_HALF_OPEN', { provider: this.key });
    }
  }

  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenProbes = 0;
    this.currentRecoveryTimeout = this.options.recoveryTimeoutMs;
    this.lastStateChange = Date.now();
  }

  getStatus() {
    return {
      provider: this.key, key: this.key, state: this.state, failureCount: this.failureCount,
      successCount: this.successCount, openCount: this.openCount,
      currentRecoveryTimeoutMs: this.currentRecoveryTimeout,
      lastFailureTime: this.lastFailureTime, lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
      timeToRecovery: this.state === CIRCUIT_STATES.OPEN
        ? Math.max(0, this.currentRecoveryTimeout - (Date.now() - this.lastFailureTime)) : 0,
    };
  }
}

// ═══ Global Manager ═══════════════════════════════════════════
class CircuitBreakerManager {
  constructor() { this.breakers = new Map(); }
  setProviderOptions(key, options) { this.breakers.set(key, new CircuitBreaker(key, options)); }
  getBreaker(key, options) {
    if (!this.breakers.has(key)) this.breakers.set(key, new CircuitBreaker(key, options));
    return this.breakers.get(key);
  }
  isAvailable(key) { return this.getBreaker(key).canCall(); }
  recordSuccess(key) { this.getBreaker(key).recordSuccess(); }
  recordFailure(key) { this.getBreaker(key).recordFailure(); }
  reset(key) { if (this.breakers.has(key)) this.breakers.get(key).reset(); }
  resetAll() { for (const [, b] of this.breakers) b.reset(); }
  getAllStatus() {
    return Array.from(this.breakers.values()).map(b => b.getStatus())
      .sort((a, b) => ({ open: 0, 'half-open': 1, closed: 2 }[a.state] ?? 3) -
                        ({ open: 0, 'half-open': 1, closed: 2 }[b.state] ?? 3));
  }
}

const manager = new CircuitBreakerManager();

// ═══ Legacy API (backward compat pour inferenceOsProxy.js) ═══
const circuitBreakers = new Map();

function getCircuitBreaker(key, options) {
  return manager.getBreaker(key, options);
}

function getAllCircuitBreakers() { return manager.getAllStatus(); }
function resetCircuitBreaker(key) { manager.reset(key); }
function resetAllCircuitBreakers() { manager.resetAll(); }

module.exports = {
  CIRCUIT_STATES,
  CircuitBreaker,
  CircuitBreakerManager,
  manager,
  // Convenience
  isAvailable: (key) => manager.isAvailable(key),
  recordSuccess: (key) => manager.recordSuccess(key),
  recordFailure: (key) => manager.recordFailure(key),
  // Legacy
  getCircuitBreaker,
  getAllCircuitBreakers,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
};
