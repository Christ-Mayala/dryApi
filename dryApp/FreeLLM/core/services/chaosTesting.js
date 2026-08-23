/**
 * Chaos Testing — Simulations contrôlées de pannes pour valider la résilience.
 *
 * Scénarios :
 *   - Random provider failure
 *   - Latency spike
 *   - Network failure
 *   - Quota exhaustion
 *   - API key failure
 *   - Partial streaming failure
 *   - Database slowdown
 *
 * Activé uniquement en mode développement/test.
 * Ne JAMAIS activer en production.
 */

const { logger } = require('./inferenceLogger');

const ChaosScenario = {
  PROVIDER_DOWN: 'provider_down',
  LATENCY_SPIKE: 'latency_spike',
  NETWORK_FAILURE: 'network_failure',
  QUOTA_EXHAUSTED: 'quota_exhausted',
  AUTH_FAILURE: 'auth_failure',
  STREAM_INTERRUPT: 'stream_interrupt',
  RATE_LIMIT: 'rate_limit',
  INVALID_RESPONSE: 'invalid_response',
};

/**
 * Chaos injection configuration per provider.
 */
class ChaosInjector {
  constructor() {
    this.activeScenarios = new Map(); // Map<provider, ScenarioConfig>
    this.enabled = false;
    this.injectionLog = [];
    this.MAX_LOG = 200;
  }

  /**
   * Enable chaos testing (MUST be explicit).
   */
  enable() {
    this.enabled = true;
    logger.event('CHAOS_TESTING_ENABLED', { timestamp: Date.now() });
  }

  /**
   * Disable all chaos.
   */
  disable() {
    this.enabled = false;
    this.activeScenarios.clear();
    logger.event('CHAOS_TESTING_DISABLED', { timestamp: Date.now() });
  }

  /**
   * Inject a scenario for a specific provider.
   *
   * @param {string} provider
   * @param {string} scenario - One of ChaosScenario
   * @param {object} options - Scenario-specific options
   * @param {number} [options.probability=1.0] - 0-1 chance of triggering
   * @param {number} [options.latencyMs=5000] - For latency spike
   * @param {string} [options.errorMessage] - Custom error message
   * @param {number} [options.duration=60000] - How long to inject (ms)
   */
  inject(provider, scenario, options = {}) {
    if (!this.enabled) return;

    const config = {
      provider,
      scenario,
      probability: options.probability ?? 1.0,
      latencyMs: options.latencyMs ?? 5000,
      errorMessage: options.errorMessage ?? this._defaultMessage(scenario, provider),
      injectedAt: Date.now(),
      duration: options.duration ?? 60_000,
      triggerCount: 0,
    };

    this.activeScenarios.set(provider, config);
    this._log('INJECT', provider, scenario, options);
  }

  /**
   * Remove chaos for a specific provider.
   */
  remove(provider) {
    this.activeScenarios.delete(provider);
    this._log('REMOVE', provider, null);
  }

  /**
   * Check if chaos should be triggered for a provider.
   * Returns the scenario to apply, or null if no chaos.
   *
   * @param {string} provider
   * @returns {{ scenario: string, config: object } | null}
   */
  check(provider) {
    if (!this.enabled) return null;

    const config = this.activeScenarios.get(provider);
    if (!config) return null;

    // Check expiry
    if (Date.now() - config.injectedAt > config.duration) {
      this.activeScenarios.delete(provider);
      return null;
    }

    // Check probability
    if (Math.random() > config.probability) {
      return null;
    }

    config.triggerCount++;
    this._log('TRIGGER', provider, config.scenario, { triggerCount: config.triggerCount });

    return { scenario: config.scenario, config };
  }

  /**
   * Apply chaos to a request (returns error or modified behavior).
   *
   * @param {string} provider
   * @returns {{ shouldFail: boolean, error: Error|null, delayMs: number, modifiedResponse: object|null }}
   */
  applyChaos(provider) {
    const result = this.check(provider);
    if (!result) {
      return { shouldFail: false, error: null, delayMs: 0, modifiedResponse: null };
    }

    const { scenario, config } = result;

    switch (scenario) {
      case ChaosScenario.PROVIDER_DOWN:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `503 ${provider} is down (chaos)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      case ChaosScenario.LATENCY_SPIKE:
        return {
          shouldFail: false,
          error: null,
          delayMs: config.latencyMs,
          modifiedResponse: null,
        };

      case ChaosScenario.NETWORK_FAILURE:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `ECONNREFUSED ${provider} (chaos)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      case ChaosScenario.QUOTA_EXHAUSTED:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `429 quota exceeded for ${provider} (chaos test)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      case ChaosScenario.AUTH_FAILURE:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `401 Unauthorized ${provider} (chaos test)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      case ChaosScenario.RATE_LIMIT:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `429 rate limit ${provider} (chaos test)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      case ChaosScenario.INVALID_RESPONSE:
        return {
          shouldFail: false,
          error: null,
          delayMs: 0,
          modifiedResponse: {
            id: `chaos-${Date.now()}`,
            choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          },
        };

      case ChaosScenario.STREAM_INTERRUPT:
        return {
          shouldFail: true,
          error: new Error(config.errorMessage || `Stream interrupted by ${provider} (chaos)`),
          delayMs: 0,
          modifiedResponse: null,
        };

      default:
        return { shouldFail: false, error: null, delayMs: 0, modifiedResponse: null };
    }
  }

  /**
   * Get status of all active chaos injections (for dashboard).
   */
  getStatus() {
    if (!this.enabled) return { enabled: false, active: [] };

    const active = [];
    for (const [provider, config] of this.activeScenarios) {
      const elapsed = Date.now() - config.injectedAt;
      active.push({
        provider,
        scenario: config.scenario,
        probability: config.probability,
        triggerCount: config.triggerCount,
        remaining: Math.max(0, config.duration - elapsed),
      });
    }

    return {
      enabled: true,
      active,
      totalTriggers: this.injectionLog.filter(l => l.event === 'TRIGGER').length,
    };
  }

  _defaultMessage(scenario, provider) {
    const p = provider || 'provider';
    const messages = {
      [ChaosScenario.PROVIDER_DOWN]: `503 ${p} is temporarily unavailable (chaos test)`,
      [ChaosScenario.LATENCY_SPIKE]: `Extreme latency on ${p} (chaos test)`,
      [ChaosScenario.NETWORK_FAILURE]: `ECONNREFUSED ${p} (chaos test)`,
      [ChaosScenario.QUOTA_EXHAUSTED]: `429 quota exceeded for ${p} (chaos test)`,
      [ChaosScenario.AUTH_FAILURE]: `401 Unauthorized ${p} (chaos test)`,
      [ChaosScenario.RATE_LIMIT]: `429 rate limit on ${p} (chaos test)`,
      [ChaosScenario.INVALID_RESPONSE]: `Invalid response from ${p} (chaos test)`,
      [ChaosScenario.STREAM_INTERRUPT]: `Stream interrupted by ${p} (chaos test)`,
    };
    return messages[scenario] || `Chaos event on ${p}`;
  }

  _log(event, provider, scenario, data = {}) {
    const entry = { event, provider, scenario, timestamp: Date.now(), ...data };
    this.injectionLog.push(entry);
    if (this.injectionLog.length > this.MAX_LOG) this.injectionLog.shift();
  }
}

// Singleton
const chaosInjector = new ChaosInjector();

module.exports = {
  ChaosScenario,
  ChaosInjector,
  chaosInjector,
};
