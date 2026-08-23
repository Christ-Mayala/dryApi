/**
 * Degraded Mode — Mode dégradé quand tous les providers cloud sont indisponibles.
 *
 * Hiérarchie de fallback :
 *   1. Tous les providers cloud DOWN
 *   2. Essayer les providers locaux (Ollama, vLLM)
 *   3. Si même le local est down → réponse dégradée contrôlée
 *   4. Jamais d'erreur incompréhensible pour le client
 *
 * Le mode dégradé est activé automatiquement quand le Health Monitor
 * détecte que tous les providers cloud sont indisponibles.
 */

const { logger } = require('./inferenceLogger');
const { monitor } = require('./providerHealthMonitor');
const { manager: circuitBreaker } = require('./circuitBreaker');

/**
 * Providers considérés comme "locaux" (peuvent fonctionner sans internet).
 */
const LOCAL_PROVIDERS = new Set(['ollama']);

/**
 * Degraded mode states.
 */
const DegradedState = {
  NORMAL: 'normal',           // tous les providers fonctionnent
  DEGRADED: 'degraded',       // certains providers down, fallback possible
  EMERGENCY: 'emergency',     // tous cloud down, essai local
  OFFLINE: 'offline',         // tout est down, mode réponse contrôlée
};

class DegradedModeManager {
  constructor() {
    this.state = DegradedState.NORMAL;
    this.lastStateChange = Date.now();
    this.cloudDownSince = null;
    this.emergencyMessage = null;
    this.stats = {
      degradedActivations: 0,
      emergencyActivations: 0,
      offlineActivations: 0,
      recoveries: 0,
    };
  }

  /**
   * Check current state based on provider health.
   * Called before each routing decision.
   *
   * @param {string[]} allProviders - List of all known providers
   * @returns {{ state: string, availableProviders: string[], message: string|null }}
   */
  evaluateState(allProviders) {
    const cloudProviders = allProviders.filter(p => !LOCAL_PROVIDERS.has(p));
    const localProviders = allProviders.filter(p => LOCAL_PROVIDERS.has(p));

    // Check cloud provider availability
    const availableCloud = cloudProviders.filter(p => circuitBreaker.isAvailable(p));
    const availableLocal = localProviders.filter(p => circuitBreaker.isAvailable(p));

    const totalAvailable = availableCloud.length + availableLocal.length;

    let newState = this.state;
    let message = null;

    if (availableCloud.length === 0 && availableLocal.length === 0) {
      // Everything is down
      newState = DegradedState.OFFLINE;
      message = 'Tous les providers sont indisponibles. Veuillez réessayer plus tard.';
      this._transition(newState, message);
      return { state: newState, availableProviders: [], message };
    }

    if (availableCloud.length === 0 && availableLocal.length > 0) {
      // Cloud down, local available
      newState = DegradedState.EMERGENCY;
      message = 'Mode dégradé : utilisation des providers locaux uniquement.';
      this._transition(newState, message);
      return { state: newState, availableProviders: availableLocal, message };
    }

    if (availableCloud.length < cloudProviders.length / 2) {
      // More than half of cloud providers are down
      newState = DegradedState.DEGRADED;
      message = `Mode dégradé : ${availableCloud.length}/${cloudProviders.length} providers cloud actifs.`;
      this._transition(newState, message);
      return { state: newState, availableProviders: [...availableCloud, ...availableLocal], message };
    }

    // Normal state
    newState = DegradedState.NORMAL;
    if (this.state !== DegradedState.NORMAL) {
      this.stats.recoveries++;
    }
    this._transition(newState, null);
    return { state: newState, availableProviders: [...availableCloud, ...availableLocal], message: null };
  }

  /**
   * Internal state transition.
   */
  _transition(newState, message) {
    if (newState !== this.state) {
      const oldState = this.state;
      this.state = newState;
      this.lastStateChange = Date.now();
      this.emergencyMessage = message;

      if (newState === DegradedState.DEGRADED) {
        this.stats.degradedActivations++;
        this.cloudDownSince = Date.now();
      } else if (newState === DegradedState.EMERGENCY) {
        this.stats.emergencyActivations++;
        if (!this.cloudDownSince) this.cloudDownSince = Date.now();
      } else if (newState === DegradedState.OFFLINE) {
        this.stats.offlineActivations++;
    } else if (newState === DegradedState.NORMAL && oldState !== DegradedState.NORMAL) {
      this.cloudDownSince = null;
      this.stats.recoveries++;
    }

      logger.event('DEGRADED_MODE_CHANGE', {
        from: oldState,
        to: newState,
        message,
        duration: this.cloudDownSince ? Date.now() - this.cloudDownSince : 0,
      });
    }
  }

  /**
   * Generate a controlled response when in OFFLINE mode.
   * The client receives a helpful response instead of an error.
   */
  generateOfflineResponse(messages, requestId) {
    const lastUserMsg = messages.findLast(m => m.role === 'user');
    const userContent = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : 'votre demande';

    return {
      id: `chatcmpl-offline-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'offline-response',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `⚠️ **Mode hors-ligne**\n\nTous les providers IA sont actuellement indisponibles.\n\nConcernant : "${userContent.slice(0, 100)}"\n\nJe ne peux pas traiter votre demande pour le moment. Veuillez :\n1. Réessayer dans quelques minutes\n2. Vérifier votre connexion internet\n3. Contacter le support si le problème persiste\n\n*Request ID: ${requestId}*`,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      _degraded: true,
      _offline: true,
    };
  }

  /**
   * Check if we're in degraded or worse mode.
   */
  isDegraded() {
    return this.state !== DegradedState.NORMAL;
  }

  /**
   * Check if we're in offline mode.
   */
  isOffline() {
    return this.state === DegradedState.OFFLINE;
  }

  /**
   * Get current status for dashboard.
   */
  getStatus() {
    return {
      state: this.state,
      lastStateChange: this.lastStateChange,
      cloudDownSince: this.cloudDownSince,
      cloudDownDuration: this.cloudDownSince ? Date.now() - this.cloudDownSince : 0,
      emergencyMessage: this.emergencyMessage,
      stats: { ...this.stats },
    };
  }
}

// Singleton
const degradedMode = new DegradedModeManager();

module.exports = {
  DegradedState,
  DegradedModeManager,
  LOCAL_PROVIDERS,
  degradedMode,
};
