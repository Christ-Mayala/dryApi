/**
 * Model Capability Registry — Registre centralisé des capacités de chaque modèle.
 *
 * Permet au router de sélectionner un modèle en fonction des besoins de la requête
 * (vision, tool_calling, structured_output, etc.) plutôt que simplement par priorité.
 */

const { logger } = require('./inferenceLogger');

/**
 * Capacités déclarées par modèle.
 * Le router utilise ces données pour le capability-based routing.
 *
 * @typedef {Object} ModelCapabilities
 * @property {boolean} text - Supporte le texte
 * @property {boolean} vision - Supporte les images
 * @property {boolean} audio - Supporte l'audio
 * @property {boolean} image_generation - Génère des images
 * @property {boolean} reasoning - Capacité de raisonnement avancé
 * @property {boolean} coding - Optimisé pour le code
 * @property {boolean} tool_calling - Supporte function/tool calling
 * @property {boolean} structured_output - Supporte JSON structured output
 * @property {boolean} json_mode - Supporte le mode JSON
 * @property {boolean} embeddings - Génère des embeddings
 * @property {boolean} long_context - Context window ≥ 100k
 * @property {boolean} streaming - Supporte le streaming SSE
 * @property {number} maxContextWindow - Taille max du contexte en tokens
 * @property {number} maxOutputTokens - Sortie max en tokens
 */

/**
 * Default capabilities (conservative defaults when model isn't in registry)
 */
const DEFAULT_CAPABILITIES = {
  text: true,
  vision: false,
  audio: false,
  image_generation: false,
  reasoning: false,
  coding: false,
  tool_calling: false,
  structured_output: false,
  json_mode: false,
  embeddings: false,
  long_context: false,
  streaming: true,
  maxContextWindow: 32768,
  maxOutputTokens: 4096,
};

/**
 * Platform-level capabilities (applied to all models of a platform unless overridden)
 */
const PLATFORM_CAPABILITIES = {
  google: {
    tool_calling: true,
    structured_output: true,
    json_mode: true,
    vision: true,
    streaming: true,
  },
  openrouter: {
    tool_calling: true,
    structured_output: true,
    json_mode: true,
    vision: true,
    streaming: true,
  },
  groq: {
    tool_calling: true,
    structured_output: true,
    json_mode: true,
    streaming: true,
  },
  openai: {
    tool_calling: true,
    structured_output: true,
    json_mode: true,
    vision: true,
    streaming: true,
  },
  mistral: {
    tool_calling: false, // Limited on some models
    structured_output: true,
    json_mode: true,
    vision: false,
    streaming: true,
  },
  cerebras: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  sambanova: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  nvidia: {
    tool_calling: false,
    structured_output: false,
    streaming: true,
  },
  cohere: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  cloudflare: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  github: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  ollama: {
    tool_calling: true,
    structured_output: true,
    streaming: true,
  },
  zhipu: {
    tool_calling: true,
    streaming: true,
  },
  kilo: {
    streaming: true,
  },
  pollinations: {
    streaming: true,
  },
  llm7: {
    streaming: true,
  },
};

/**
 * Model-specific overrides.
 * Key format: "platform:modelId"
 */
const MODEL_OVERRIDES = {
  // Google Gemini models — all support vision + tools
  'google:gemini-2.5-pro': { vision: true, tool_calling: true, reasoning: true, coding: true, long_context: true, maxContextWindow: 1048576, maxOutputTokens: 65536 },
  'google:gemini-2.5-flash': { vision: true, tool_calling: true, reasoning: true, coding: true, long_context: true, maxContextWindow: 1048576, maxOutputTokens: 65536 },
  'google:gemini-2.5-flash-lite': { vision: true, tool_calling: true, coding: true, maxContextWindow: 1048576, maxOutputTokens: 65536 },
  'google:gemini-3.1-pro-preview': { vision: true, tool_calling: true, reasoning: true, coding: true, long_context: true, maxContextWindow: 1048576, maxOutputTokens: 65536 },

  // OpenRouter free models
  'openrouter:qwen/qwen3-coder:free': { coding: true, tool_calling: true, long_context: true, maxContextWindow: 262144 },
  'openrouter:minimax/minimax-m2.5:free': { reasoning: true, coding: true, long_context: true, maxContextWindow: 196608 },

  // Cerebras — fast but limited
  'cerebras:llama3.1-8b': { coding: false, long_context: false, maxContextWindow: 131072 },

  // Mistral — coding models
  'mistral:codestral-latest': { coding: true, tool_calling: false, maxContextWindow: 32000 },
  'mistral:devstral-latest': { coding: true, tool_calling: false, maxContextWindow: 131072 },
  'mistral:mistral-large-latest': { reasoning: true, coding: true, tool_calling: true, maxContextWindow: 131072 },

  // Ollama local models
  'ollama:qwen3-coder:480b': { coding: true, tool_calling: true, reasoning: true, long_context: true, maxContextWindow: 262144 },
  'ollama:deepseek-v3.2': { coding: true, reasoning: true, long_context: true, maxContextWindow: 131072 },

  // DeepSeek on SambaNova
  'sambanova:DeepSeek-V3.2': { coding: true, reasoning: true, long_context: true, maxContextWindow: 131072 },
};

/**
 * In-memory registry, populated at startup from the DB model catalog
 * and enriched with static capability data.
 */
const registry = new Map(); // Map<"platform:modelId", ModelCapabilities>

/**
 * Build the capability key for a model.
 */
function makeKey(platform, modelId) {
  return `${platform}:${modelId}`;
}

/**
 * Initialize the registry from the database model catalog.
 * Called once at startup.
 *
 * @param {Array} models - Array of model documents from MongoDB
 */
function initializeRegistry(models) {
  registry.clear();

  for (const model of models) {
    const key = makeKey(model.platform, model.modelId);
    const platformCaps = PLATFORM_CAPABILITIES[model.platform] || {};
    const modelOverrides = MODEL_OVERRIDES[key] || {};

    const capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...platformCaps,
      ...modelOverrides,
      maxContextWindow: model.contextWindow || modelOverrides.maxContextWindow || DEFAULT_CAPABILITIES.maxContextWindow,
    };

    registry.set(key, capabilities);
  }

  logger.debug('[CapabilityRegistry]', {
    event: 'INITIALIZED',
    modelCount: registry.size,
  });
}

/**
 * Get capabilities for a specific model.
 *
 * @param {string} platform
 * @param {string} modelId
 * @returns {ModelCapabilities}
 */
function getCapabilities(platform, modelId) {
  const key = makeKey(platform, modelId);
  return registry.get(key) || { ...DEFAULT_CAPABILITIES };
}

/**
 * Find all models that match a set of required capabilities.
 *
 * @param {object} requirements - Required capabilities
 * @param {boolean} [requirements.vision]
 * @param {boolean} [requirements.tool_calling]
 * @param {boolean} [requirements.coding]
 * @param {boolean} [requirements.reasoning]
 * @param {boolean} [requirements.structured_output]
 * @param {boolean} [requirements.long_context]
 * @param {number} [requirements.minContextWindow]
 * @param {string[]} [availableModels] - List of "platform:modelId" to filter against
 * @returns {string[]} Array of "platform:modelId" that match
 */
function findModelsByCapabilities(requirements, availableModels = null) {
  const matches = [];

  const candidates = availableModels || Array.from(registry.keys());

  for (const key of candidates) {
    const caps = registry.get(key);
    if (!caps) continue;

    let match = true;

    // Check all boolean capability requirements dynamically
    const booleanCaps = ['vision', 'audio', 'image_generation', 'reasoning', 'coding',
      'tool_calling', 'structured_output', 'json_mode', 'embeddings', 'long_context', 'streaming'];
    for (const cap of booleanCaps) {
      if (requirements[cap] && !caps[cap]) match = false;
    }
    if (requirements.minContextWindow && caps.maxContextWindow < requirements.minContextWindow) match = false;

    if (match) matches.push(key);
  }

  return matches;
}

/**
 * Check if a specific model supports a capability.
 */
function hasCapability(platform, modelId, capability) {
  const caps = getCapabilities(platform, modelId);
  return caps[capability] === true;
}

/**
 * Get all registered capabilities (for dashboard/debug).
 */
function getAllCapabilities() {
  const result = [];
  for (const [key, caps] of registry.entries()) {
    const [platform, ...modelParts] = key.split(':');
    result.push({
      platform,
      modelId: modelParts.join(':'),
      ...caps,
    });
  }
  return result;
}

module.exports = {
  DEFAULT_CAPABILITIES,
  MODEL_OVERRIDES,
  initializeRegistry,
  getCapabilities,
  findModelsByCapabilities,
  hasCapability,
  getAllCapabilities,
  makeKey,
};
