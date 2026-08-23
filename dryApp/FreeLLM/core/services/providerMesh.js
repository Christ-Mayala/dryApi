/**
 * Provider Mesh — Routing à 2 niveaux : Provider × Credential.
 *
 * Problème résolu :
 *   - Ne JAMAIS marquer "Provider X = DOWN" pour une seule clé
 *   - Choisir la MEILLEURE clé, pas seulement le meilleur provider
 *   - Vérifier la capacité AVANT chaque fallback
 *   - Ne jamais retry ce qui a déjà échoué dans cette requête
 *
 * Architecture :
 *
 *   Request
 *      │
 *      ▼
 *   Capability Matching
 *      │
 *      ▼
 *   Credential Scoring (par clé, pas par provider)
 *      │
 *      ▼
 *   Attempt Filtering (skip ce qui a déjà échoué)
 *      │
 *      ▼
 *   Best Provider + Best Key
 *      │
 *   SUCCESS → return
 *   FAILURE → next candidate (pas le même!)
 *      │
 *   ALL EXHAUSTED → Ollama → Offline
 */

const { logger } = require('./inferenceLogger.js');
const { credentialIntelligence, CredentialStatus } = require('./credentialIntelligence.js');
const { requestAttemptRegistry } = require('./requestAttemptRegistry.js');
const { classifyError } = require('./errorClassifier.js');
const { degradedMode } = require('./degradedMode.js');
const capabilityRegistry = require('./modelCapabilityRegistry.js');

// ═══════════════════════════════════════════════════════════════
// ROUTING STRATEGIES
// ═══════════════════════════════════════════════════════════════

const RoutingStrategy = {
  BALANCED: 'balanced',
  QUALITY_FIRST: 'quality_first',
  COST_FIRST: 'cost_first',
  LATENCY_FIRST: 'latency_first',
  RELIABILITY_FIRST: 'reliability_first',
  CAPABILITY_FIRST: 'capability_first',
};

// ═══════════════════════════════════════════════════════════════
// PROVIDER MESH — Central routing engine
// ═══════════════════════════════════════════════════════════════

class ProviderMesh {
  constructor() {
    this.providers = new Map(); // provider → { models, capabilities, priority, ... }
    this.metrics = {
      totalRouted: 0,
      totalFallbacks: 0,
      totalSuccess: 0,
      totalFailure: 0,
    };
  }

  /**
   * Register a provider in the mesh.
   */
  registerProvider(config) {
    this.providers.set(config.name, {
      name: config.name,
      displayName: config.displayName || config.name,
      models: config.models || [],
      capabilities: config.capabilities || ['text'],
      priority: config.priority || 5,
      enabled: config.enabled !== false,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Get candidates matching requirements.
   *
   * @param {object} requirements - { capabilities: ['coding', 'tool_calling'], model: 'auto' }
   * @param {object} attempts - RequestAttempts instance (to skip failed)
   * @returns {Array} Sorted candidates: [{ provider, keyId, model, score }]
   */
  getCandidates(requirements = {}, attempts = null) {
    const requiredCaps = requirements.capabilities || [];
    const candidates = [];

    for (const [providerName, provider] of this.providers) {
      if (!provider.enabled) continue;

      // Check if this provider was already tried and failed
      if (attempts && attempts.hasFailedProvider(providerName)) continue;

      // Get available credentials for this provider
      const credentials = credentialIntelligence.getAvailableCredentials(providerName);
      if (credentials.length === 0) continue;

      // For each credential, check what models it can serve
      for (const cred of credentials) {
        // Skip if this specific key already failed
        if (attempts && attempts.hasFailedKey(providerName, cred.keyId)) continue;

        // Find models matching capabilities
        const matchingModels = this._findMatchingModels(provider, requiredCaps, attempts);

        for (const model of matchingModels) {
          const score = this._calculateScore(provider, cred, model, requirements);
          candidates.push({
            provider: providerName,
            keyId: cred.keyId,
            model: model.modelId,
            modelDbId: model._id || model.modelId,
            displayName: provider.displayName,
            score,
            credentialScore: cred.getScore(),
          });
        }
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Find models matching capability requirements.
   */
  _findMatchingModels(provider, requiredCaps, attempts) {
    const models = [];

    for (const model of provider.models) {
      // Skip if model was already tried on this provider
      if (attempts && attempts.hasTriedModel(model.modelId) && attempts.hasTriedProvider(provider.name)) {
        continue;
      }

      // Check capabilities
      if (requiredCaps.length > 0) {
        const modelCaps = model.capabilities || ['text'];
        const hasAll = requiredCaps.every(cap => modelCaps.includes(cap));
        if (!hasAll) continue;
      }

      models.push(model);
    }

    return models;
  }

  /**
   * Calculate a composite score for a candidate.
   */
  _calculateScore(provider, credential, model, requirements) {
    let score = 0;

    // Credential health (0-40)
    score += credential.getScore() * 0.4;

    // Provider priority (0-20)
    score += (10 - provider.priority) * 2;

    // Model quality (0-20)
    const intelligenceRank = model.intelligenceRank || 50;
    score += (100 - intelligenceRank) * 0.2;

    // Speed (0-10)
    const speedRank = model.speedRank || 50;
    score += (100 - speedRank) * 0.1;

    // Cost (0-10, lower cost = higher score)
    const inputCost = model.inputCost || 0;
    if (inputCost === 0) score += 10;
    else if (inputCost < 1) score += 7;
    else if (inputCost < 5) score += 4;
    else score += 1;

    return Math.round(score);
  }

  /**
   * Route a request to the best candidate.
   *
   * @param {object} requirements - Capability requirements
   * @param {string} requestId - Request ID for attempt tracking
   * @param {object} options - { preferredModel, strategy, maxAttempts }
   * @returns {{ success, provider, keyId, model, candidates, attempts }}
   */
  route(requirements, requestId, options = {}) {
    const startTime = Date.now();
    const maxAttempts = options.maxAttempts || 20;

    // Get or create attempt tracker
    let attempts = requestAttemptRegistry.getRequest(requestId);
    if (!attempts) {
      attempts = requestAttemptRegistry.createRequest(requestId);
    }

    // Get candidates
    const allCandidates = this.getCandidates(requirements, attempts);

    // Filter to max attempts
    const candidates = allCandidates.slice(0, maxAttempts);

    if (candidates.length === 0) {
      // Check if we're in degraded mode
      if (degradedMode.isOffline()) {
        return {
          success: false,
          error: 'All providers unavailable and system is in offline mode',
          candidates: [],
          attempts: attempts.getSummary(),
          degraded: true,
        };
      }

      // Check if we can use local provider (Ollama)
      if (credentialIntelligence.providerHasAvailableCredential('ollama')) {
        return {
          success: false,
          error: 'No cloud providers available, local provider may be used',
          candidates: [],
          attempts: attempts.getSummary(),
          suggestLocal: true,
        };
      }

      return {
        success: false,
        error: 'No providers available with required capabilities',
        candidates: [],
        attempts: attempts.getSummary(),
        noCapable: requirements.capabilities?.length > 0,
      };
    }

    // Return top candidates (the caller will try them one by one)
    const best = candidates[0];

    logger.event('PROVIDER_MESH_ROUTED', {
      requestId,
      provider: best.provider,
      keyId: best.keyId,
      model: best.model,
      score: best.score,
      totalCandidates: candidates.length,
    });

    this.metrics.totalRouted++;

    return {
      success: true,
      provider: best.provider,
      keyId: best.keyId,
      model: best.model,
      displayName: best.displayName,
      score: best.score,
      candidates,
      attempts: attempts.getSummary(),
    };
  }

  /**
   * Get the next candidate after a failure.
   */
  getNextCandidate(requirements, requestId) {
    const attempts = requestAttemptRegistry.getRequest(requestId);
    if (!attempts) return null;

    const candidates = this.getCandidates(requirements, attempts);
    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Record the result of a routing attempt.
   */
  recordResult(requestId, provider, keyId, model, success, latencyMs, error = null, errorCategory = null) {
    const attempts = requestAttemptRegistry.getRequest(requestId);
    if (!attempts) return;

    // Find the in-progress attempt for this provider+key
    const attemptIndex = attempts.attempts.findIndex(
      a => a.provider === provider && a.keyId === keyId && a.status === 'in_progress'
    );

    if (attemptIndex === -1) return;

    if (success) {
      attempts.endAttemptSuccess(attemptIndex, latencyMs);
      credentialIntelligence.recordSuccess(provider, keyId, latencyMs);
      this.metrics.totalSuccess++;
    } else {
      attempts.endAttemptFailure(attemptIndex, latencyMs, error, errorCategory);
      credentialIntelligence.recordFailure(provider, keyId, error, errorCategory);
      this.metrics.totalFallbacks++;
      this.metrics.totalFailure++;
    }
  }

  /**
   * Start an attempt (mark as in-progress).
   */
  startAttempt(requestId, provider, keyId, model) {
    const attempts = requestAttemptRegistry.getRequest(requestId);
    if (attempts) {
      attempts.startAttempt(provider, keyId, model);
    }
  }

  /**
   * Check if a provider is available (dynamic).
   */
  isProviderAvailable(provider) {
    const p = this.providers.get(provider);
    if (!p || !p.enabled) return false;
    return credentialIntelligence.providerHasAvailableCredential(provider);
  }

  /**
   * Get status.
   */
  getStatus() {
    const providerStatus = {};
    for (const [name] of this.providers) {
      providerStatus[name] = {
        enabled: this.providers.get(name).enabled,
        available: this.isProviderAvailable(name),
        ...credentialIntelligence.getProviderStatus(name),
      };
    }

    return {
      providerCount: this.providers.size,
      availableProviders: Array.from(this.providers.values()).filter(p => p.enabled && this.isProviderAvailable(p.name)).length,
      metrics: { ...this.metrics },
      providers: providerStatus,
      attemptStats: requestAttemptRegistry.getStats(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const providerMesh = new ProviderMesh();

module.exports = {
  ProviderMesh,
  RoutingStrategy,
  providerMesh,
};
