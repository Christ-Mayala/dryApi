const path = require('path');
const express = require('express');
const getModel = require('../../dry/core/factories/modelFactory');
const { initEncryptionKey } = require('./core/lib/crypto');
const { seedFreeLLM } = require('./seed');
const { createFreeLLMProxyRouter } = require('./core/routes/proxy');
const { createKeysRouter } = require('./core/routes/keys');
const { createFallbackRouter } = require('./core/routes/fallback');
const { createAnalyticsRouter } = require('./core/routes/analytics');
const { createSettingsRouter } = require('./core/routes/settings');
const { createHealthRouter } = require('./core/routes/health');
const { createConversationsRouter } = require('./core/routes/conversations');
const ModelsSchema = require('./features/models/model/models.schema');
const ApiKeysSchema = require('./features/apiKeys/model/apiKeys.schema');
const FallbackConfigSchema = require('./features/fallbackConfig/model/fallbackConfig.schema');
const RequestsSchema = require('./features/requests/model/requests.schema');
const SettingsSchema = require('./features/settings/model/settings.schema');
const ConversationsSchema = require('./features/conversations/model/conversations.schema');
const ConversationMessagesSchema = require('./features/conversationMessages/model/conversationMessages.schema');

let unifiedApiKey = null;

async function initFreeLLM(appName) {
  console.log('🚀 Initializing FreeLLM...');
  
  const Models = getModel(appName, 'Models', ModelsSchema);
  const ApiKeys = getModel(appName, 'ApiKeys', ApiKeysSchema);
  const FallbackConfig = getModel(appName, 'FallbackConfig', FallbackConfigSchema);
  const Requests = getModel(appName, 'Requests', RequestsSchema);
  const Settings = getModel(appName, 'Settings', SettingsSchema);
  const Conversations = getModel(appName, 'Conversations', ConversationsSchema);
  const ConversationMessages = getModel(appName, 'ConversationMessages', ConversationMessagesSchema);
  
  await initEncryptionKey(Settings);
  
  const seededKey = await seedFreeLLM(Models, FallbackConfig, Settings);
  if (seededKey) unifiedApiKey = seededKey;
  
  console.log('✅ FreeLLM initialized!');
  
  return { Models, ApiKeys, FallbackConfig, Requests, Settings, Conversations, ConversationMessages, unifiedApiKey };
}

function mountFreeLLMRoutes(app, appName, Models, ApiKeys, FallbackConfig, Requests, Settings, Conversations, ConversationMessages, unifiedKey) {
  console.log('🔍 mountFreeLLMRoutes called!');
  console.log('🔍 Adding routes:');
  
  const proxyRouter = createFreeLLMProxyRouter(Models, ApiKeys, FallbackConfig, Requests, unifiedKey);
  app.use(`/v1`, proxyRouter);
  console.log('   ✅ /v1 → proxyRouter');
  
  const keysRouter = createKeysRouter(ApiKeys);
  app.use(`/api/keys`, keysRouter);
  console.log('   ✅ /api/keys → keysRouter');
  
  const fallbackRouter = createFallbackRouter(Models, FallbackConfig, ApiKeys, Requests);
  app.use(`/api/fallback`, fallbackRouter);
  console.log('   ✅ /api/fallback → fallbackRouter');
  
  const analyticsRouter = createAnalyticsRouter(Models, Requests);
  app.use(`/api/analytics`, analyticsRouter);
  console.log('   ✅ /api/analytics → analyticsRouter');
  
  const settingsRouter = createSettingsRouter(Settings);
  app.use(`/api/settings`, settingsRouter);
  console.log('   ✅ /api/settings → settingsRouter');
  
  const healthRouter = createHealthRouter(Models, ApiKeys);
  app.use(`/api/health`, healthRouter);
  console.log('   ✅ /api/health → healthRouter');
  
  const conversationsRouter = createConversationsRouter(Conversations, ConversationMessages);
  app.use(`/api/conversations`, conversationsRouter);
  console.log('   ✅ /api/conversations → conversationsRouter');
  
  console.log(`✅ FreeLLM routes mounted`);
}

module.exports = {
  initFreeLLM,
  mountFreeLLMRoutes,
  getUnifiedApiKey: () => unifiedApiKey
};
