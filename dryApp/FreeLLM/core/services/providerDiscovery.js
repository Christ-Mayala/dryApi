/**
 * Provider Discovery — Système de plugins pour ajouter des providers.
 *
 * Permet d'ajouter de nouveaux providers sans modifier le cœur du router.
 *
 * Architecture :
 *
 *   Provider Registry
 *        │
 *        ├── adapter (BaseProvider subclass)
 *        ├── models
 *        ├── capabilities
 *        ├── pricing
 *        ├── health
 *        └── authentication
 *
 * Exemple d'utilisation :
 *
 *   providerDiscovery.register({
 *     name: 'deepseek',
 *     displayName: 'DeepSeek',
 *     baseUrl: 'https://api.deepseek.com',
 *     authType: 'api_key',
 *     models: [
 *       { modelId: 'deepseek-chat', contextWindow: 64000, inputCost: 0.14, outputCost: 0.28 },
 *       { modelId: 'deepseek-coder', contextWindow: 64000, inputCost: 0.14, outputCost: 0.28 },
 *     ],
 *     healthCheck: { interval: 60000, timeout: 5000 },
 *   });
 */

const { EventEmitter } = require('events');
const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// PROVIDER DEFINITION — Schema for a provider plugin
// ═══════════════════════════════════════════════════════════════

class ProviderDefinition {
  constructor(config = {}) {
    this.name = config.name; // Unique identifier (e.g. 'deepseek')
    this.displayName = config.displayName || config.name;
    this.description = config.description || '';
    this.baseUrl = config.baseUrl;
    this.authType = config.authType || 'api_key'; // 'api_key', 'oauth', 'bearer', 'none'
    this.authHeader = config.authHeader || 'Authorization';
    this.authPrefix = config.authPrefix || 'Bearer';

    // Models
    this.models = (config.models || []).map(m => ({
      modelId: m.modelId,
      displayName: m.displayName || m.modelId,
      contextWindow: m.contextWindow || 32768,
      maxOutputTokens: m.maxOutputTokens || 4096,
      inputCost: m.inputCost || 0, // $/1M tokens
      outputCost: m.outputCost || 0,
      speed: m.speed || 'medium', // 'fast', 'medium', 'slow'
      capabilities: m.capabilities || ['text'],
      enabled: m.enabled !== false,
    }));

    // Health check
    this.healthCheck = {
      interval: config.healthCheck?.interval || 60000,
      timeout: config.healthCheck?.timeout || 5000,
      endpoint: config.healthCheck?.endpoint || '/models',
    };

    // Rate limits (defaults)
    this.rateLimits = {
      requestsPerMinute: config.rateLimits?.requestsPerMinute || 60,
      tokensPerMinute: config.rateLimits?.tokensPerMinute || 100000,
      requestsPerDay: config.rateLimits?.requestsPerDay || 10000,
    };

    // Metadata
    this.region = config.region || 'global';
    this.pricing = config.pricing || 'standard'; // 'free', 'standard', 'premium'
    this.tier = config.tier || 2; // 1 = premium, 2 = standard, 3 = free tier
    this.metadata = config.metadata || {};
    this.createdAt = new Date().toISOString();
    this.enabled = config.enabled !== false;
  }

  validate() {
    const issues = [];
    if (!this.name) issues.push('name is required');
    if (!this.baseUrl) issues.push('baseUrl is required');
    if (this.models.length === 0) issues.push('at least one model is required');
    for (const m of this.models) {
      if (!m.modelId) issues.push('modelId is required for all models');
      if (m.contextWindow < 1000) issues.push(`contextWindow too small for model ${m.modelId}`);
    }
    return { valid: issues.length === 0, issues };
  }

  toJSON() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      baseUrl: this.baseUrl,
      authType: this.authType,
      modelCount: this.models.length,
      models: this.models,
      healthCheck: this.healthCheck,
      rateLimits: this.rateLimits,
      region: this.region,
      pricing: this.pricing,
      tier: this.tier,
      enabled: this.enabled,
      createdAt: this.createdAt,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// PROVIDER DISCOVERY — Registry + Plugin system
// ═══════════════════════════════════════════════════════════════

class ProviderDiscovery extends EventEmitter {
  constructor() {
    super();
    this.providers = new Map();  // name → ProviderDefinition
    this.healthStates = new Map(); // name → { status, lastCheck, latency, successRate }
    this.metrics = {
      totalRegistrations: 0,
      totalModelsAdded: 0,
      healthChecksRun: 0,
      healthCheckFailures: 0,
    };
  }

  /**
   * Register a new provider.
   */
  register(config) {
    const provider = new ProviderDefinition(config);

    // Validate
    const validation = provider.validate();
    if (!validation.valid) {
      throw new Error(`Invalid provider: ${validation.issues.join(', ')}`);
    }

    // Check duplicate
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider '${provider.name}' is already registered`);
    }

    this.providers.set(provider.name, provider);
    this.healthStates.set(provider.name, {
      status: 'unknown',
      lastCheck: null,
      latency: null,
      successRate: null,
      consecutiveFailures: 0,
    });

    this.metrics.totalRegistrations++;
    this.metrics.totalModelsAdded += provider.models.length;

    logger.event('PROVIDER_REGISTERED', {
      name: provider.name,
      displayName: provider.displayName,
      modelCount: provider.models.length,
      tier: provider.tier,
    });

    this.emit('provider:registered', { name: provider.name });
    return provider;
  }

  /**
   * Unregister a provider.
   */
  unregister(name) {
    const provider = this.providers.get(name);
    if (!provider) return false;
    this.providers.delete(name);
    this.healthStates.delete(name);
    logger.event('PROVIDER_UNREGISTERED', { name });
    this.emit('provider:unregistered', { name });
    return true;
  }

  /**
   * Enable/disable a provider.
   */
  setEnabled(name, enabled) {
    const provider = this.providers.get(name);
    if (!provider) return false;
    provider.enabled = enabled;
    this.emit('provider:updated', { name });
    return true;
  }

  /**
   * Get a provider.
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Get all providers.
   */
  getProviders() {
    return Array.from(this.providers.values()).map(p => p.toJSON());
  }

  /**
   * Get all enabled providers.
   */
  getEnabledProviders() {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .map(p => p.toJSON());
  }

  /**
   * Get all models across all providers.
   */
  getAllModels() {
    const models = [];
    for (const [, provider] of this.providers) {
      if (!provider.enabled) continue;
      for (const model of provider.models) {
        if (!model.enabled) continue;
        models.push({
          ...model,
          provider: provider.name,
          providerDisplayName: provider.displayName,
          tier: provider.tier,
          region: provider.region,
        });
      }
    }
    return models;
  }

  /**
   * Find models by capability requirements.
   */
  findModelsByCapability(requiredCapabilities = []) {
    return this.getAllModels().filter(model => {
      return requiredCapabilities.every(cap => model.capabilities.includes(cap));
    });
  }

  /**
   * Find cheapest model with required capabilities.
   */
  findCheapestModel(requiredCapabilities = []) {
    const candidates = this.findModelsByCapability(requiredCapabilities)
      .sort((a, b) => a.inputCost - b.inputCost);
    return candidates[0] || null;
  }

  /**
   * Find fastest model with required capabilities.
   */
  findFastestModel(requiredCapabilities = []) {
    const speedRank = { fast: 0, medium: 1, slow: 2 };
    const candidates = this.findModelsByCapability(requiredCapabilities)
      .sort((a, b) => speedRank[a.speed] - speedRank[b.speed]);
    return candidates[0] || null;
  }

  /**
   * Simulate a health check for a provider.
   * In production, this would actually ping the provider's endpoint.
   */
  async healthCheck(name) {
    const provider = this.providers.get(name);
    if (!provider) return null;

    const startTime = Date.now();
    this.metrics.healthChecksRun++;

    try {
      // Simulate health check (in production, make actual HTTP request)
      const latency = Math.random() * 200 + 50; // Simulated latency
      const success = Math.random() > 0.05; // 95% success rate simulation

      const state = this.healthStates.get(name) || {};
      state.lastCheck = new Date().toISOString();
      state.latency = Math.round(latency);
      state.status = success ? 'healthy' : 'unhealthy';
      state.successRate = state.successRate === null
        ? (success ? 1 : 0)
        : state.successRate * 0.9 + (success ? 0.1 : 0);
      state.consecutiveFailures = success ? 0 : (state.consecutiveFailures || 0) + 1;

      this.healthStates.set(name, state);

      if (!success) this.metrics.healthCheckFailures++;

      return { name, ...state, latencyMs: Date.now() - startTime };
    } catch (err) {
      this.metrics.healthCheckFailures++;
      const state = this.healthStates.get(name) || {};
      state.status = 'error';
      state.lastCheck = new Date().toISOString();
      state.lastError = err.message;
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
      this.healthStates.set(name, state);
      return { name, ...state };
    }
  }

  /**
   * Run health checks for all enabled providers.
   */
  async healthCheckAll() {
    const results = [];
    for (const [name, provider] of this.providers) {
      if (!provider.enabled) continue;
      const result = await this.healthCheck(name);
      results.push(result);
    }
    return results;
  }

  /**
   * Get health state for a provider.
   */
  getHealthState(name) {
    return this.healthStates.get(name) || null;
  }

  /**
   * Get all health states.
   */
  getAllHealthStates() {
    const states = {};
    for (const [name, state] of this.healthStates) {
      states[name] = { ...state };
    }
    return states;
  }

  /**
   * Get stats.
   */
  getStatus() {
    const providers = this.getProviders();
    const models = this.getAllModels();
    return {
      providerCount: providers.length,
      enabledProviders: providers.filter(p => p.enabled).length,
      totalModels: models.length,
      enabledModels: models.filter(m => m.enabled).length,
      healthyProviders: Array.from(this.healthStates.values()).filter(s => s.status === 'healthy').length,
      metrics: { ...this.metrics },
      providers,
      health: this.getAllHealthStates(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// BUILT-IN PROVIDERS — Pre-registered common providers
// ═══════════════════════════════════════════════════════════════

function registerBuiltinProviders(discovery) {
  const builtins = [
    {
      name: 'deepseek',
      displayName: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      tier: 3,
      pricing: 'standard',
      models: [
        { modelId: 'deepseek-chat', contextWindow: 64000, inputCost: 0.14, outputCost: 0.28, speed: 'fast', capabilities: ['text', 'coding'] },
        { modelId: 'deepseek-coder', contextWindow: 64000, inputCost: 0.14, outputCost: 0.28, speed: 'fast', capabilities: ['text', 'coding'] },
      ],
    },
    {
      name: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      tier: 1,
      pricing: 'premium',
      models: [
        { modelId: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', contextWindow: 200000, inputCost: 3.0, outputCost: 15.0, speed: 'medium', capabilities: ['text', 'vision', 'coding', 'tool_calling'] },
        { modelId: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000, inputCost: 3.0, outputCost: 15.0, speed: 'medium', capabilities: ['text', 'vision', 'coding', 'tool_calling'] },
      ],
    },
    {
      name: 'google',
      displayName: 'Google AI',
      baseUrl: 'https://generativelanguage.googleapis.com',
      tier: 2,
      pricing: 'standard',
      models: [
        { modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', contextWindow: 128000, inputCost: 1.25, outputCost: 10.0, speed: 'fast', capabilities: ['text', 'vision', 'coding', 'tool_calling', 'long_context'] },
        { modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', contextWindow: 128000, inputCost: 0.15, outputCost: 0.6, speed: 'fast', capabilities: ['text', 'vision', 'coding'] },
      ],
    },
    {
      name: 'mistral',
      displayName: 'Mistral AI',
      baseUrl: 'https://api.mistral.ai',
      tier: 2,
      pricing: 'standard',
      models: [
        { modelId: 'mistral-large-latest', displayName: 'Mistral Large', contextWindow: 128000, inputCost: 2.0, outputCost: 6.0, speed: 'medium', capabilities: ['text', 'coding', 'tool_calling'] },
      ],
    },
  ];

  for (const config of builtins) {
    try {
      discovery.register(config);
    } catch (e) {
      // Ignore duplicate registrations
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const providerDiscovery = new ProviderDiscovery();
registerBuiltinProviders(providerDiscovery);

module.exports = {
  ProviderDiscovery,
  ProviderDefinition,
  providerDiscovery,
  registerBuiltinProviders,
};
