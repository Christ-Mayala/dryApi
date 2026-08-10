const CIRCUIT_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open'
};

const DEFAULT_OPTIONS = {
  failureThreshold: 5, // Nombre d'échecs avant d'ouvrir le circuit
  resetTimeoutMs: 30000, // Délai avant de passer en half-open
  halfOpenMaxRequests: 1 // Nombre de requêtes autorisées en half-open
};

const redisStore = require('./inferenceRedisStore');

class CircuitBreaker {
  constructor(key, options = {}) {
    this.key = key;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  canCall() {
    const now = Date.now();

    if (this.state === CIRCUIT_STATES.OPEN) {
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.lastStateChange = now;
        this.successCount = 0;
      }
    }

    if (this.state === CIRCUIT_STATES.CLOSED) {
      return true;
    }

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      return this.successCount < this.options.halfOpenMaxRequests;
    }

    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxRequests) {
        this.state = CIRCUIT_STATES.CLOSED;
        this.lastStateChange = Date.now();
      }
    }
    this._persist();
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATES.CLOSED && this.failureCount >= this.options.failureThreshold) {
      this.state = CIRCUIT_STATES.OPEN;
      this.lastStateChange = Date.now();
    } else if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.OPEN;
      this.lastStateChange = Date.now();
    }
    this._persist();
  }

  getStatus() {
    return {
      key: this.key,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      timeToReset: this.state === CIRCUIT_STATES.OPEN
        ? Math.max(0, this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime))
        : 0
    };
  }

  _persist() {
    redisStore.setCircuitBreakerState(this.key, this.getStatus()).catch(() => {});
  }
}

function getCircuitBreaker(key, options) {
  // Tentative de chargement depuis Redis (non bloquant)
  redisStore.getCircuitBreakerState(key).then(state => {
    if (state) {
      const cb = new CircuitBreaker(key, options);
      cb.state = state.state || CIRCUIT_STATES.CLOSED;
      cb.failureCount = state.failureCount || 0;
      cb.successCount = state.successCount || 0;
      cb.lastFailureTime = state.lastFailureTime || null;
      cb.lastStateChange = state.lastStateChange || Date.now();
      // Remplacer dans le Map local si il existe
      if (circuitBreakers.has(key)) {
        const existing = circuitBreakers.get(key);
        Object.assign(existing, cb);
      }
    }
  }).catch(() => {});

  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new CircuitBreaker(key, options));
  }
  return circuitBreakers.get(key);
}

function getAllCircuitBreakers() {
  const result = [];
  for (const [key, cb] of circuitBreakers.entries()) {
    result.push(cb.getStatus());
  }
  return result;
}

function resetCircuitBreaker(key) {
  circuitBreakers.delete(key);
  redisStore.deleteCircuitBreakerState(key).catch(() => {});
}

function resetAllCircuitBreakers() {
  circuitBreakers.clear();
  redisStore.getAllCircuitBreakerStates().then(states => {
    for (const state of states) {
      redisStore.deleteCircuitBreakerState(state.key).catch(() => {});
    }
  }).catch(() => {});
}

module.exports = {
  CIRCUIT_STATES,
  CircuitBreaker,
  getCircuitBreaker,
  getAllCircuitBreakers,
  resetCircuitBreaker,
  resetAllCircuitBreakers
};
