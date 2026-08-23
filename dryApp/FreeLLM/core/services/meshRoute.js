/**
 * Mesh Route Adapter — Bridge entre Provider Mesh et enhancedProxy.js.
 *
 * Remplace l'appel à `routeRequest()` du vieux router.js
 * avec le Provider Mesh + Credential Intelligence + Attempt Registry.
 *
 * Retourne le même format que l'ancien routeRequest pour compatibilité :
 *   { provider, apiKey, modelId, platform, keyId, modelDbId, displayName }
 */

const { providerMesh } = require('./providerMesh.js');
const { credentialIntelligence } = require('./credentialIntelligence.js');
const { requestAttemptRegistry } = require('./requestAttemptRegistry.js');
const capabilityRegistry = require('./modelCapabilityRegistry.js');
const { degradedMode } = require('./degradedMode.js');
const { logger } = require('./inferenceLogger.js');

/**
 * Route une requête via Provider Mesh.
 *
 * @param {object} params
 * @param {Array} params.models - Modèles disponibles (depuis MongoDB)
 * @param {Array} params.apiKeys - Clés API disponibles (depuis MongoDB)
 * @param {string} params.requestId - ID unique de la requête
 * @param {string} params.taskType - Type de tâche (chat, code, etc.)
 * @param {boolean} params.hasTools - Si la requête utilise des outils
 * @param {number} params.totalTokens - Tokens totaux estimés
 * @param {Set} params.skipKeys - Clés à ignorer (déjà essayées)
 * @param {string} params.preferredModel - Modèle préféré (si spécifique)
 * @returns {{ provider, apiKey, modelId, platform, keyId, modelDbId, displayName, mesh }}
 */
async function meshRoute({
  models = [],
  apiKeys = [],
  requestId,
  taskType = 'chat',
  hasTools = false,
  totalTokens = 0,
  skipKeys = new Set(),
  preferredModel = null,
  userId = null,
}) {
  // ═══ STEP 1: Dynamic Degraded Mode Check ═══
  const allPlatforms = [...new Set(models.map(m => m.platform))];
  const degradedResult = degradedMode.evaluateState(allPlatforms);

  // ═══ STEP 2: Build requirements from task ═══
  const requirements = buildRequirements(taskType, hasTools);

  // ═══ STEP 3: Register providers in mesh from MongoDB data ═══
  syncMeshWithDB(models, apiKeys);

  // ═══ STEP 4: Get attempt tracker ═══
  let attempts = requestAttemptRegistry.getRequest(requestId);
  if (!attempts) {
    attempts = requestAttemptRegistry.createRequest(requestId);
  }

  // ═══ STEP 5: Get candidates from Provider Mesh ═══
  const candidates = providerMesh.getCandidates(requirements, attempts);

  if (candidates.length === 0) {
    // No cloud providers available — check local
    if (credentialIntelligence.providerHasAvailableCredential('ollama')) {
      return buildLocalRoute('ollama', requestId);
    }

    throw {
      status: 429,
      message: `No providers available with required capabilities: ${requirements.capabilities?.join(', ') || 'any'}`,
    };
  }

  // ═══ STEP 6: Filter out skipKeys ═══
  const filtered = candidates.filter(c => {
    const skipId = `${c.provider}:${c.model}:${c.keyId}`;
    return !skipKeys.has(skipId);
  });

  if (filtered.length === 0) {
    throw {
      status: 429,
      message: 'All provider candidates exhausted for this request',
    };
  }

  // ═══ STEP 7: Pick best candidate ═══
  const best = filtered[0];

  // ═══ STEP 8: Find actual provider instance + API key ═══
  const providerInstance = findProviderInstance(best.provider);
  const apiKeyRecord = findApiKey(apiKeys, best.provider, best.keyId);

  if (!providerInstance) {
    // Provider instance not found in local adapters —
    // signal enhancedProxy to use legacy router
    return null;
  }

  // ═══ STEP 9: Start attempt tracking ═══
  providerMesh.startAttempt(requestId, best.provider, best.keyId, best.model);

  // ═══ STEP 10: Return in legacy format ═══
  return {
    provider: providerInstance,
    apiKey: apiKeyRecord?.apiKey || '',
    modelId: best.model,
    platform: best.provider,
    keyId: apiKeyRecord?._id || best.keyId,
    modelDbId: best.modelDbId,
    displayName: best.displayName,
    score: best.score,
    mesh: {
      requestId,
      candidateCount: filtered.length,
      strategy: 'provider_mesh',
    },
  };
}

/**
 * Record the result of a mesh routing attempt.
 */
function recordMeshResult(requestId, provider, keyId, model, success, latencyMs, error = null, errorCategory = null) {
  providerMesh.recordResult(requestId, provider, keyId, model, success, latencyMs, error, errorCategory);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Build capability requirements from task type.
 */
function buildRequirements(taskType, hasTools) {
  const capabilities = ['text'];

  switch (taskType) {
    case 'code':
      capabilities.push('coding');
      break;
    case 'reasoning':
      capabilities.push('reasoning');
      break;
    case 'vision':
      capabilities.push('vision');
      break;
  }

  if (hasTools) {
    capabilities.push('tool_calling');
  }

  return { capabilities };
}

/**
 * Sync Provider Mesh with MongoDB data.
 * Registers providers + credentials from DB.
 */
function syncMeshWithDB(models, apiKeys) {
  // Group models by platform
  const providerModels = {};
  for (const model of models) {
    if (!providerModels[model.platform]) {
      providerModels[model.platform] = [];
    }
    providerModels[model.platform].push({
      modelId: model.modelId,
      _id: model._id,
      displayName: model.displayName || model.modelId,
      contextWindow: model.contextWindow || 32768,
      intelligenceRank: model.intelligenceRank || 50,
      speedRank: model.speedRank || 50,
      capabilities: model.capabilities || ['text'],
      inputCost: model.inputCost || 0,
      outputCost: model.outputCost || 0,
    });
  }

  // Register providers in mesh
  for (const [platform, pModels] of Object.entries(providerModels)) {
    const existing = providerMesh.providers.get(platform);
    if (!existing) {
      providerMesh.registerProvider({
        name: platform,
        displayName: platform,
        models: pModels,
      });
    } else {
      // Update models
      existing.models = pModels;
    }
  }

  // Register credentials from API keys
  for (const key of apiKeys) {
    if (!key.platform && !key.provider) continue;
    const platform = key.platform || key.provider;

    // Skip if already registered
    const existing = credentialIntelligence.getCredential(platform, String(key._id));
    if (!existing) {
      credentialIntelligence.registerCredential(platform, String(key._id), {
        priority: key.priority || 5,
        maxPerMinute: key.rpm || 60,
        dailyLimit: key.rpd || 10000,
        tokenLimit: key.tpm || 1000000,
      });
    }
  }
}

/**
 * Find provider instance from the global provider registry.
 * This bridges with the existing BaseProvider classes.
 */
function findProviderInstance(platform) {
  try {
    // Try to load provider from existing registry
    const providers = require('./providers.js');
    if (providers && providers[platform]) {
      return providers[platform];
    }
  } catch {}

  // Fallback: try direct require
  try {
    const providerMap = {
      groq: () => require('./providers/groq.provider'),
      google: () => require('./providers/google.provider'),
      openai: () => require('./providers/openai.provider'),
      mistral: () => require('./providers/mistral.provider'),
      ollama: () => require('./providers/ollama.provider'),
    };

    const loader = providerMap[platform.toLowerCase()];
    if (loader) {
      return loader();
    }
  } catch {}

  return null;
}

/**
 * Find API key record from MongoDB keys.
 */
function findApiKey(apiKeys, platform, keyId) {
  return apiKeys.find(k => {
    const kPlatform = k.platform || k.provider;
    return kPlatform === platform && String(k._id) === keyId;
  }) || null;
}

/**
 * Build a route for local provider (Ollama).
 */
function buildLocalRoute(platform, requestId) {
  throw {
    status: 503,
    message: `Local provider '${platform}' is not configured or unavailable`,
  };
}

module.exports = {
  meshRoute,
  recordMeshResult,
  syncMeshWithDB,
  buildRequirements,
};
