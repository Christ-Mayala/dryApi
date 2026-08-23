/**
 * Fallback Engine — Système de fallback hiérarchique capability-aware.
 *
 * Niveaux de fallback :
 *   LEVEL 1 : Même provider → autre modèle compatible
 *   LEVEL 2 : Même provider → autre clé API
 *   LEVEL 3 : Provider différent → modèle équivalent
 *   LEVEL 4 : Free tier provider (OpenRouter, Pollinations, LLM7)
 *   LEVEL 5 : Local provider (Ollama / vLLM)
 *   LEVEL 6 : Mode dégradé (réponse contrôlée)
 *
 * Le fallback respecte les capabilities : une requête vision ne tombera
 * jamais vers un modèle text-only.
 */

const { logger } = require('./inferenceLogger');
const { getCapabilities, findModelsByCapabilities } = require('./modelCapabilityRegistry');
const { manager: circuitBreaker } = require('./circuitBreaker');
const { monitor: healthMonitor } = require('./providerHealthMonitor');
const { degradedMode, LOCAL_PROVIDERS } = require('./degradedMode');

const FallbackLevel = {
  SAME_PROVIDER_MODEL: 1,   // Switch model on same provider
  SAME_PROVIDER_KEY: 2,     // Switch key on same provider
  DIFFERENT_PROVIDER: 3,    // Switch to different provider
  FREE_TIER: 4,             // Prefer free tier providers
  LOCAL: 5,                 // Local providers (Ollama)
  DEGRADED: 6,              // Controlled degraded response
};

const FREE_TIER_PROVIDERS = new Set([
  'openrouter', 'pollinations', 'llm7', 'kilo', 'ollama',
]);

/**
 * Build capability requirements from a request's context.
 *
 * @param {object} reqBody - The /v1/chat/completions request body
 * @returns {object} Capability requirements
 */
function buildRequirementsFromRequest(reqBody) {
  const requirements = {};

  // Detect vision from message content
  if (reqBody.messages) {
    for (const msg of reqBody.messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url') {
            requirements.vision = true;
            break;
          }
        }
      }
    }
  }

  // Detect tool calling
  if (reqBody.tools && reqBody.tools.length > 0) {
    requirements.tool_calling = true;
  }

  // Detect structured output
  if (reqBody.response_format?.type === 'json_object') {
    requirements.json_mode = true;
  }

  return requirements;
}

/**
 * Select the best fallback level and strategy.
 *
 * @param {string} failedProvider - Provider that just failed
 * @param {string} failedModel - Model that just failed
 * @param {string} failedKeyId - Key that just failed
 * @param {number} fallbackCount - Current fallback attempt number
 * @param {Set} skippedKeys - Keys already tried
 * @param {object} requirements - Capability requirements
 * @returns {{ level: number, strategy: string, description: string }}
 */
function selectFallbackLevel(failedProvider, failedModel, failedKeyId, fallbackCount, skippedKeys, requirements) {
  // Level determination based on fallback count and context
  if (fallbackCount === 0) {
    return {
      level: FallbackLevel.SAME_PROVIDER_KEY,
      strategy: 'try_another_key',
      description: `Trying another key on ${failedProvider}`,
    };
  }

  if (fallbackCount === 1) {
    return {
      level: FallbackLevel.DIFFERENT_PROVIDER,
      strategy: 'try_different_provider',
      description: `Switching to a different provider`,
    };
  }

  if (fallbackCount === 2) {
    return {
      level: FallbackLevel.FREE_TIER,
      strategy: 'prefer_free_tier',
      description: 'Falling back to free tier providers',
    };
  }

  if (fallbackCount === 3) {
    return {
      level: FallbackLevel.LOCAL,
      strategy: 'try_local',
      description: 'Falling back to local providers (Ollama)',
    };
  }

  return {
    level: FallbackLevel.DEGRADED,
    strategy: 'degraded_mode',
    description: 'Entering degraded mode',
  };
}

/**
 * Filter models by fallback level and requirements.
 *
 * @param {Array} allModels - All available models from DB
 * @param {number} level - Fallback level
 * @param {string} failedProvider - Provider that failed
 * @param {string} failedModel - Model that failed
 * @param {object} requirements - Capability requirements
 * @param {Set} skippedKeys - Keys/models to skip
 * @returns {Array} Filtered and scored models
 */
function filterModelsByLevel(allModels, level, failedProvider, failedModel, requirements, skippedKeys) {
  return allModels.filter(model => {
    const modelKey = `${model.platform}:${model.modelId}`;
    const skipKey = `${model.platform}:${model.modelId}`;

    // Skip already-tried models
    if (skippedKeys.has(skipKey)) return false;

    // Skip if circuit breaker is open
    if (!circuitBreaker.isAvailable(model.platform)) return false;

    // Level-specific filtering
    switch (level) {
      case FallbackLevel.SAME_PROVIDER_KEY:
        // Stay on same provider, different model
        return model.platform === failedProvider && model.modelId !== failedModel;

      case FallbackLevel.SAME_PROVIDER_MODEL:
        return model.platform === failedProvider;

      case FallbackLevel.DIFFERENT_PROVIDER:
        return model.platform !== failedProvider;

      case FallbackLevel.FREE_TIER:
        return FREE_TIER_PROVIDERS.has(model.platform);

      case FallbackLevel.LOCAL:
        return LOCAL_PROVIDERS.has(model.platform);

      default:
        return true;
    }
  }).filter(model => {
    // Capability filtering (always applied)
    const caps = getCapabilities(model.platform, model.modelId);
    if (requirements.vision && !caps.vision) return false;
    if (requirements.tool_calling && !caps.tool_calling) return false;
    if (requirements.json_mode && !caps.json_mode) return false;
    return true;
  });
}

module.exports = {
  FallbackLevel,
  FREE_TIER_PROVIDERS,
  buildRequirementsFromRequest,
  selectFallbackLevel,
  filterModelsByLevel,
};
