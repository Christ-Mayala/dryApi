const { decrypt } = require('../lib/crypto.js');
const { canMakeRequest, canUseTokens, isOnCooldown } = require('./ratelimit.js');
const { getProvider } = require('../providers/index.js');
const { getCircuitBreaker } = require('./circuitBreaker.js');
const { getSuccessRate, getAvgLatency } = require('./performanceMetrics.js');
const { getProviderScore, IDE_PREFERRED_PROVIDERS } = require('./keyPoolManager.js');

// Round-robin index per platform
const roundRobinIndex = new Map();

// ── Dynamic priority: track 429s per model and demote accordingly ──
// Key: modelDbId -> { count, lastHit, penalty }
const rateLimitPenalties = new Map();

// Penalty decays over time so models recover
const PENALTY_PER_429 = 3;        // each 429 adds this many priority positions
const MAX_PENALTY = 10;            // cap so a model doesn't sink forever
const DECAY_INTERVAL_MS = 2 * 60 * 1000; // penalty decays every 2 minutes
const DECAY_AMOUNT = 1;            // remove this much penalty per decay interval

/**
 * Record a 429 for a model — increases its penalty so it sinks in priority.
 */
function recordRateLimitHit(modelDbId) {
  const existing = rateLimitPenalties.get(modelDbId);
  const now = Date.now();
  if (existing) {
    existing.count++;
    existing.lastHit = now;
    existing.penalty = Math.min(existing.penalty + PENALTY_PER_429, MAX_PENALTY);
  } else {
    rateLimitPenalties.set(modelDbId, { count: 1, lastHit: now, penalty: PENALTY_PER_429 });
  }
}

/**
 * Record a success for a model — reduces its penalty so it rises back up.
 */
function recordSuccess(modelDbId) {
  const existing = rateLimitPenalties.get(modelDbId);
  if (existing) {
    existing.penalty = Math.max(0, existing.penalty - 1);
    if (existing.penalty === 0) {
      rateLimitPenalties.delete(modelDbId);
    }
  }
}

/**
 * Get the current penalty for a model (with time-based decay).
 */
function getPenalty(modelDbId) {
  const entry = rateLimitPenalties.get(modelDbId);
  if (!entry) return 0;

  // Apply time-based decay
  const now = Date.now();
  const elapsed = now - entry.lastHit;
  const decaySteps = Math.floor(elapsed / DECAY_INTERVAL_MS);
  if (decaySteps > 0) {
    entry.penalty = Math.max(0, entry.penalty - (decaySteps * DECAY_AMOUNT));
    entry.lastHit = now; // reset so we don't double-decay
    if (entry.penalty === 0) {
      rateLimitPenalties.delete(modelDbId);
      return 0;
    }
  }

  return entry.penalty;
}

/**
 * Get current penalties for all models (for the API/dashboard).
 */
function getAllPenalties() {
  const result = [];
  for (const [modelDbId, entry] of rateLimitPenalties.entries()) {
    const penalty = getPenalty(modelDbId);
    if (penalty > 0) {
      result.push({ modelDbId: String(modelDbId), count: entry.count, penalty });
    }
  }
  return result.sort((a, b) => b.penalty - a.penalty);
}

/**
 * Calcul un score intelligent pour un modèle basé sur:
 * - Priorité de base
 * - Pénalité rate limit
 * - Taux de succès
 * - Latence moyenne
 * - Classement vitesse/intelligence
 */
function calculateModelScore(entry, model, isIdeMode) {
  const basePriority = entry.priority || 0;
  const ratePenalty = getPenalty(entry.modelDbId);
  
  const successRate = getSuccessRate(model.platform, model.modelId);
  const avgLatency = getAvgLatency(model.platform, model.modelId);
  
  // Get dynamic provider score from keyPoolManager
  const providerScore = getProviderScore(model.platform);
  
  // Score final (plus haut = mieux)
  let score = providerScore; // Base score = dynamic provider score
  
  // Adjust with fallback config priority
  score -= basePriority * 5;
  
  // Rate limit penalty
  score -= ratePenalty * 20;
  
  // Success rate bonus (0-100 points)
  score += successRate * 100;
  
  // Latency bonus (0-50 points, lower is better)
  const latencyScore = Math.min(1, 10000 / (avgLatency || 10000));
  score += latencyScore * 50;
  
  // Speed rank bonus (0-40 points, lower is better)
  score += (20 - (model.speedRank || 10)) * 2;
  
  return score;
}

/**
 * Route a request to the best available model.
 * Models are sorted by intelligent score.
 *
 * If preferredModelDbId is set, that model gets tried FIRST (sticky sessions).
 * This prevents hallucination from model switching mid-conversation.
 *
 * @param ModelsModel - Mongoose model for Models collection
 * @param ApiKeysModel - Mongoose model for ApiKeys collection
 * @param FallbackConfigModel - Mongoose model for FallbackConfig collection
 * @param estimatedTokens - estimated total tokens for rate limit check
 * @param skipKeys - set of "platform:modelId:keyId" to skip (failed on this request)
 * @param preferredModelDbId - try this model first (sticky session)
 * @param requestType - type de requête (chat, code, reasoning) pour adapter le routing
 */
async function routeRequest(ModelsModel, ApiKeysModel, FallbackConfigModel, estimatedTokens = 1000, skipKeys = new Set(), preferredModelDbId, requestType = 'chat', isIdeMode = false, hasTools = false) {
  // Get fallback chain ordered by priority
  const fallbackChain = await FallbackConfigModel.find({ deletedAt: null, enabled: true })
    .sort({ priority: 1 })
    .lean();

  // Récupérer tous les modèles en une seule requête
  const modelDbIds = fallbackChain.map(entry => entry.modelDbId);
  const allModels = await ModelsModel.find({ _id: { $in: modelDbIds }, enabled: true, deletedAt: null }).lean();
  const modelMap = new Map();
  for (const model of allModels) {
    modelMap.set(String(model._id), model);
  }

  // Calculer les scores et trier
  const scoredChain = fallbackChain
    .filter(entry => modelMap.has(String(entry.modelDbId)))
    .map(entry => {
      const model = modelMap.get(String(entry.modelDbId));
      return {
        ...entry,
        model,
        score: calculateModelScore(entry, model, isIdeMode)
      };
    })
    .filter(entry => {
      // Si la requête a des outils, on écarte NVIDIA
      if (hasTools && entry.model.platform.toLowerCase().includes('nvidia')) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score); // Du plus haut score au plus bas

  // Sticky session: move preferred model to front of chain
  if (preferredModelDbId) {
    const idx = scoredChain.findIndex(e => String(e.modelDbId) === String(preferredModelDbId));
    if (idx > 0) {
      const [preferred] = scoredChain.splice(idx, 1);
      scoredChain.unshift(preferred);
    }
  }

  for (const entry of scoredChain) {
    const model = entry.model;
    if (!model) continue;

    // Vérifier le circuit breaker
    const cbKey = `${model.platform}:${model.modelId}`;
    const circuitBreaker = getCircuitBreaker(cbKey);
    if (!circuitBreaker.canCall()) {
      continue;
    }

    // Check if we have a provider for this platform
    const provider = getProvider(model.platform);
    if (!provider) continue;

    // Get all healthy, enabled keys for this platform
    const keys = await ApiKeysModel.find({ 
      platform: model.platform, 
      enabled: true, 
      status: { $ne: 'invalid' },
      deletedAt: null 
    }).lean();

    if (keys.length === 0) continue;

    // Get limits once for this model
    const limits = {
      rpm: model.rpmLimit,
      rpd: model.rpdLimit,
      tpm: model.tpmLimit,
      tpd: model.tpdLimit,
    };

    // Try all keys for this model before giving up on it
    const rrKey = `${model.platform}:${model.modelId}`;
    let idx = roundRobinIndex.get(rrKey) || 0;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[idx % keys.length];
      idx++;

      const skipId = `${model.platform}:${model.modelId}:${key._id}`;
      if (skipKeys.has(skipId)) continue;

      // Check cooldown (from previous 429s)
      if (isOnCooldown(model.platform, model.modelId, key._id)) continue;

      if (!canMakeRequest(model.platform, model.modelId, key._id, limits)) continue;
      if (!canUseTokens(model.platform, model.modelId, key._id, estimatedTokens, limits)) continue;

      // We found a working key for this model!
      roundRobinIndex.set(rrKey, idx);
      
      // Check if key fields are present
      if (!key.encryptedKey || !key.iv || !key.authTag) {
        continue;
      }
      
      let decryptedKey;
      try {
        decryptedKey = decrypt(key.encryptedKey, key.iv, key.authTag);
      } catch {
        continue;
      }

      return {
        provider,
        modelId: model.modelId,
        modelDbId: model._id,
        apiKey: decryptedKey,
        keyId: key._id,
        platform: model.platform,
        displayName: model.displayName,
        score: entry.score
      };
    }

    // If we reach here, this specific model has NO available keys.
    // Update round-robin index even if we failed so we don't get stuck.
    roundRobinIndex.set(rrKey, idx);
  }

  const err = new Error('All models exhausted. Add more API keys or wait for rate limits to reset.');
  err.status = 429;
  throw err;
}

module.exports = {
  recordRateLimitHit,
  recordSuccess,
  getAllPenalties,
  routeRequest
};
