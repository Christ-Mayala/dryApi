const path = require('path');
const express = require('express');
const getModel = require('../../dry/core/factories/modelFactory');
const UserSchema = require('../../dry/modules/user/user.schema');
const { initEncryptionKey } = require('./core/lib/crypto');
const { seedFreeLLM } = require('./seed');
const capabilityRegistry = require('./core/services/modelCapabilityRegistry');
// Use Enhanced Proxy (integrates all new modules: error classifier, response validator,
// circuit breaker V2, health monitor, degraded mode, fallback engine, policy engine,
// quota engine, smart retry, capability registry)
const { createEnhancedProxyRouter } = require('./core/routes/enhancedProxy');
const { createKeysRouter } = require('./core/routes/keys');
const { createFallbackRouter } = require('./core/routes/fallback');
const { createAnalyticsRouter } = require('./core/routes/analytics');
const { createSettingsRouter } = require('./core/routes/settings');
const { createHealthRouter } = require('./core/routes/health');
const { createConversationsRouter } = require('./core/routes/conversations');
const { createPDFRouter } = require('./core/routes/pdf');
const { createChaosRouter } = require('./core/routes/chaos');
const { createDashboardRouter } = require('./core/routes/dashboard');
const { createMCPRoutes } = require('./core/routes/mcp');
const { createTokenOptimizationRoutes } = require('./core/routes/tokenOptimization');
const { createA2ARoutes } = require('./core/routes/a2a');
const { createChaosApiRoutes } = require('./core/routes/chaosApi');
const { createFrontendRouter } = require('./core/routes/frontend');
const authRoutes = require('../../dry/modules/user/auth.routes');
const ModelsSchema = require('./features/models/model/models.schema');
const ApiKeysSchema = require('./features/apiKeys/model/apiKeys.schema');
const FallbackConfigSchema = require('./features/fallbackConfig/model/fallbackConfig.schema');
const RequestsSchema = require('./features/requests/model/requests.schema');
const SettingsSchema = require('./features/settings/model/settings.schema');
const SystemSettingsSchema = require('./features/admin/model/systemSettings.schema');
const ConversationsSchema = require('./features/conversations/model/conversations.schema');
const ConversationMessagesSchema = require('./features/conversationMessages/model/conversationMessages.schema');

let unifiedApiKey = null;

async function initFreeLLM(appName) {
  console.log('🚀 Initializing FreeLLM...');
  
  const User = getModel(appName, 'User', UserSchema);
  const Models = getModel(appName, 'Models', ModelsSchema);
  const ApiKeys = getModel(appName, 'ApiKeys', ApiKeysSchema);
  const FallbackConfig = getModel(appName, 'FallbackConfig', FallbackConfigSchema);
  const Requests = getModel(appName, 'Requests', RequestsSchema);
  const Settings = getModel(appName, 'Settings', SettingsSchema);
  const SystemSettings = getModel(appName, 'SystemSettings', SystemSettingsSchema);
  const Conversations = getModel(appName, 'Conversations', ConversationsSchema);
  const ConversationMessages = getModel(appName, 'ConversationMessages', ConversationMessagesSchema);
  
  await initEncryptionKey(Settings);
  
  const seededKey = await seedFreeLLM(Models, FallbackConfig, Settings, SystemSettings);
  if (seededKey) unifiedApiKey = seededKey;

  // Initialize capability registry with all models
  const allModels = await Models.find({ deletedAt: null }).lean();
  capabilityRegistry.initializeRegistry(allModels);
  console.log(`   🧠 Capability registry initialized: ${allModels.length} models`);

  // Initialize distributed state (Redis or in-memory fallback)
  const { distributedState } = require('./core/services/distributedState.js');
  const redisUrl = process.env.REDIS_URL || null;
  const stateMode = await distributedState.initialize(redisUrl);
  console.log(`   📡 Distributed state: ${stateMode}`);

  console.log('✅ FreeLLM initialized!');
  
  return { User, Models, ApiKeys, FallbackConfig, Requests, Settings, SystemSettings, Conversations, ConversationMessages, unifiedApiKey };
}

function mountFreeLLMRoutes(app, appName, User, Models, ApiKeys, FallbackConfig, Requests, Settings, SystemSettings, Conversations, ConversationMessages, unifiedKey) {
  console.log('🔍 mountFreeLLMRoutes called!');
  console.log('🔍 Adding routes:');
  
  const freeLLMRouter = express.Router();
  
  freeLLMRouter.use((req, res, next) => {
    req.appName = appName;
    req.getModel = (modelName, schema) => getModel(appName, modelName, schema);
    next();
  });
  
  freeLLMRouter.use(`/api/user`, authRoutes);
  console.log('   ✅ /api/user → authRoutes');
  
  const proxyRouter = createEnhancedProxyRouter(Models, ApiKeys, FallbackConfig, Requests, unifiedKey);
  freeLLMRouter.use(`/v1`, proxyRouter);
  console.log('   ✅ /v1 → enhancedProxyRouter');
  
  const keysRouter = createKeysRouter(ApiKeys);
  freeLLMRouter.use(`/api/keys`, keysRouter);
  console.log('   ✅ /api/keys → keysRouter');
  
  const fallbackRouter = createFallbackRouter(Models, FallbackConfig, ApiKeys, Requests);
  freeLLMRouter.use(`/api/fallback`, fallbackRouter);
  console.log('   ✅ /api/fallback → fallbackRouter');
  
  const analyticsRouter = createAnalyticsRouter(Models, Requests);
  freeLLMRouter.use(`/api/analytics`, analyticsRouter);
  console.log('   ✅ /api/analytics → analyticsRouter');
  
  const settingsRouter = createSettingsRouter(Settings);
  freeLLMRouter.use(`/api/settings`, settingsRouter);
  console.log('   ✅ /api/settings → settingsRouter');
  
  const healthRouter = createHealthRouter(Models, ApiKeys);
  freeLLMRouter.use(`/api/health`, healthRouter);
  console.log('   ✅ /api/health → healthRouter');
  
  const conversationsRouter = createConversationsRouter(Conversations, ConversationMessages);
  freeLLMRouter.use(`/api/conversations`, conversationsRouter);
  console.log('   ✅ /api/conversations → conversationsRouter');

  const pdfRouter = createPDFRouter();
  freeLLMRouter.use(`/api/pdf`, pdfRouter);
  console.log('   ✅ /api/pdf → pdfRouter');

  const chaosRouter = createChaosRouter();
  freeLLMRouter.use(`/api/chaos`, chaosRouter);
  console.log('   ✅ /api/chaos → chaosRouter');

  const dashboardRouter = createDashboardRouter(Models, ApiKeys);
  freeLLMRouter.use(`/api/dashboard`, dashboardRouter);
  console.log('   ✅ /api/dashboard → dashboardRouter');

  // MCP routes
  const mcpRouter = createMCPRoutes();
  freeLLMRouter.use(`/api/mcp`, mcpRouter);
  console.log('   ✅ /api/mcp → mcpRouter');

  // Token Optimization routes
  const tokenOptRouter = createTokenOptimizationRoutes();
  freeLLMRouter.use(`/api/token-optimization`, tokenOptRouter);
  console.log('   ✅ /api/token-optimization → tokenOptRouter');

  // A2A Agent-to-Agent routes
  const a2aRouter = createA2ARoutes();
  freeLLMRouter.use(`/api/a2a`, a2aRouter);
  console.log('   ✅ /api/a2a → a2aRouter');

  // Chaos Testing API routes
  const chaosApiRouter = createChaosApiRoutes();
  freeLLMRouter.use(`/api/chaos-api`, chaosApiRouter);
  console.log('   ✅ /api/chaos-api → chaosApiRouter');

  // Frontend (Dashboard)
  const frontendRouter = createFrontendRouter();
  freeLLMRouter.use('/', frontendRouter);
  console.log('   ✅ /dashboard → frontendRouter');

  app.use(freeLLMRouter);
  
  console.log(`✅ FreeLLM routes mounted`);
}

module.exports = {
  initFreeLLM,
  mountFreeLLMRoutes,
  getUnifiedApiKey: () => unifiedApiKey
};
