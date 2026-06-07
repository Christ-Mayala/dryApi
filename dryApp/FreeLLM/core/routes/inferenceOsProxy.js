const crypto = require('crypto');
const express = require('express');
const { routeRequest, recordRateLimitHit, recordSuccess } = require('../services/router.js');
const { recordRequest, recordTokens, setCooldown } = require('../services/ratelimit.js');
const perfMetrics = require('../services/performanceMetrics.js');
const { getCacheKey, get, set } = require('../services/responseCache.js');
const tokenEstimator = require('../services/tokenEstimator.js');
const contextManager = require('../services/contextManager.js');
const requestClassifier = require('../services/requestClassifier.js');
const keyPoolManager = require('../services/keyPoolManager.js');
const fastPathLayer = require('../services/fastPathLayer.js');
const ideMode = require('../services/ideMode.js');
const toolRuntime = require('../services/toolRuntime.js');
const { createProfiler, logger, circuitBreaker } = require('../services/inferenceLogger.js');

const AUTO_MODEL_ID = 'auto';

function isAutoModel(modelId) {
  return modelId === AUTO_MODEL_ID;
}

function timingSafeStringEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const compareA = a.length === b.length ? a : Buffer.alloc(b.length);
  return crypto.timingSafeEqual(compareA, b) && a.length === b.length;
}

const stickySessionMap = new Map();
const STICKY_TTL_MS = 30 * 60 * 1000;

function getSessionKey(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '';
  
  let contentToHash;
  if (typeof firstUser.content === 'string') {
    contentToHash = firstUser.content;
  } else if (Array.isArray(firstUser.content)) {
    contentToHash = JSON.stringify(firstUser.content);
  } else {
    return '';
  }
  
  const hash = crypto.createHash('sha1').update(contentToHash).digest('hex');
  return hash + ':' + (messages.length > 2 ? 'multi' : 'single');
}

function getStickyModel(messages) {
  const hasAssistant = messages.some(m => m.role === 'assistant');
  if (!hasAssistant) return undefined;

  const key = getSessionKey(messages);
  if (!key) return undefined;

  const entry = stickySessionMap.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.lastUsed > STICKY_TTL_MS) {
    stickySessionMap.delete(key);
    return undefined;
  }
  return entry.modelDbId;
}

function setStickyModel(messages, modelDbId) {
  const key = getSessionKey(messages);
  if (!key) return;
  stickySessionMap.set(key, { modelDbId: modelDbId, lastUsed: Date.now() });

  if (stickySessionMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of stickySessionMap.entries()) {
      if (now - v.lastUsed > STICKY_TTL_MS) stickySessionMap.delete(k);
    }
  }
}

const MAX_FALLBACKS = 1;

// GLOBAL RUNTIME TOKEN BUDGET PER CONVERSATION (INCREASED A LOT)
const CONVERSATION_TOKEN_BUDGET = 1000000; // 1 MILLION tokens max per conversation
const conversationTokenUsage = new Map(); // Map<convId, {usedTokens: number, createdAt: number}>
const CONVERSATION_BUDGET_TTL = 3600000 * 24; // 24 hours

async function logRequest(RequestsModel, userId, platform, modelId, keyId, status, inputTokens, outputTokens, latencyMs, error, taskType, fallbackCount, requestId) {
  try {
    // Generate unique slug using crypto.randomUUID() to avoid collisions
    const slug = `${platform}-${crypto.randomUUID()}`;
    await RequestsModel.create({
      userId,
      platform,
      modelId,
      keyId,
      status,
      inputTokens,
      outputTokens,
      latencyMs,
      error,
      taskType,
      fallbackCount,
      requestId,
      slug
    });
  } catch (e) {
    logger.error({
      component: 'InferenceOS',
      event: 'LOG_REQUEST_FAILED',
      requestId,
      error: e.message
    });
  }
}

function createFreeLLMProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, unifiedApiKey) {
  const router = express.Router();
  
  // Initialize key pool manager and wire DB model for persistent blacklisting
  keyPoolManager.initializeKeyPool(ApiKeysModel);
  keyPoolManager.setApiKeysModel(ApiKeysModel);
  
  router.get('/models', async (req, res) => {
    const models = await ModelsModel.find({ enabled: true, deletedAt: null })
      .sort({ intelligenceRank: 1 })
      .lean();
    
    res.json({
      object: 'list',
      data: [
        {
          id: AUTO_MODEL_ID,
          object: 'model',
          created: 0,
          owned_by: 'freellmapi',
          name: 'Auto (Inference OS picks best available model)',
          context_window: 128000,
        },
        ...models.map(m => ({
          id: m.modelId,
          object: 'model',
          created: 0,
          owned_by: m.platform,
          name: m.displayName,
          context_window: m.contextWindow || 32768,
        })),
      ],
    });
  });

  // Route pour lister les outils disponibles
  router.get('/tools', (req, res) => {
    res.json({
      object: 'list',
      data: toolRuntime.getAvailableTools().map(toolName => ({
        name: toolName,
        type: 'tool'
      })),
      request_id: crypto.randomUUID()
    });
  });

  // Route pour exécuter des outils avec fallback LLM
  router.post('/tools/execute', async (req, res) => {
    const requestId = crypto.randomUUID();
    try {
      const { tool_name, tool_args, user_request } = req.body;
      
      if (!tool_name) {
        return res.status(400).json({
          error: {
            message: 'Le champ tool_name est obligatoire',
            type: 'invalid_request_error',
            request_id: requestId
          }
        });
      }
      
      logger.debug({
        component: 'ToolRuntime',
        event: 'EXECUTE_START',
        requestId,
        toolName: tool_name
      });
      
      const result = await toolRuntime.executeToolRequest({
        toolName: tool_name,
        toolArgs: tool_args || {},
        userRequest: user_request || req.body.messages?.map(m => m.content).join('\n') || ''
      });
      
      logger.debug({
        component: 'ToolRuntime',
        event: 'EXECUTE_COMPLETE',
        requestId,
        toolName: tool_name,
        success: result.success,
        usedFallback: result.used_fallback
      });
      
      res.status(200).json({
        ...result,
        request_id: requestId
      });
    } catch (error) {
      logger.error({
        component: 'ToolRuntime',
        event: 'EXECUTE_FAILED',
        requestId,
        error: error.message
      });
      res.status(500).json({
        error: {
          message: `Erreur serveur: ${error.message}`,
          type: 'server_error',
          request_id: requestId
        }
      });
    }
  });

  router.post('/chat/completions', async (req, res) => {
    const profiler = createProfiler();
    profiler.mark('start');
    
    const requestId = crypto.randomUUID();
    let fallbackCount = 0;
    let taskType = 'chat';
    let cacheHit = false;
    let compressionRatio = 0;
    let tokensSaved = 0;
    let processedMessages = req.body.messages;
    let keyId = null;

    let finalStatus = 'error';
    let finalError = null;
    let routeContext = { platform: null, modelId: null };
    let isIdeMode = false;
    let tokensContext = { originalInput: 0, processedInput: 0, output: 0, total: 0, saved: 0, conversationUsed: 0 };
    let isFinalized = false;

    const finalizeRequest = () => {
      if (isFinalized) return;
      isFinalized = true;
      finalStatus = 'error';
        finalError = finalError;
        routeContext.platform = routeContext.platform;
        routeContext.modelId = routeContext.modelId;
        if (null !== null) tokensContext = null;
        // logger.request removed
    };

    try {
      let userId = null;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const User = req.getModel('User');

    const authStart = Date.now();
    if (token && timingSafeStringEqual(token, unifiedApiKey)) {
      const admin = await User.findOne({ role: 'admin' }).lean();
      userId = admin ? admin._id : null;
      if (!userId) {
        const firstUser = await User.findOne().lean();
        userId = firstUser ? firstUser._id : null;
      }
    } else if (token) {
      try {
        const { verifyToken } = require('../../../../dry/utils/auth/jwt.util');
        const decoded = verifyToken(token);
        userId = decoded.id;
      } catch (err) {
        profiler.mark('auth');
        finalStatus = 'error';
        finalError = 'Invalid API key or JWT token';
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
        res.status(401).json({
          error: { message: 'Invalid API key or JWT token', type: 'authentication_error' },
        });
        return;
      }
    }

    if (!userId) {
      profiler.mark('auth');
      finalStatus = 'error';
        finalError = 'Authentication required';
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
      res.status(401).json({
        error: { message: 'Authentication required', type: 'authentication_error' },
      });
      return;
    }
    profiler.mark('auth');

    const requestedModel = req.body.model;
    const temperature = req.body.temperature;
    const max_tokens = req.body.max_tokens || 1000;
    const top_p = req.body.top_p;
    const stream = req.body.stream;
    const tools = req.body.tools;
    const tool_choice = req.body.tool_choice;
    const parallel_tool_calls = req.body.parallel_tool_calls;
    const messages = req.body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      finalStatus = 400;
      finalError = "Invalid request: 'messages' array is required and cannot be empty.";
      res.status(400).json({ error: { message: finalError, type: 'invalid_request_error', requestId } });
      return;
    }
    
    // Check if at least one message has non-empty content
    const hasValidContent = messages.some(m => {
      if (typeof m.content === 'string') return m.content.trim().length > 0;
      if (Array.isArray(m.content)) return m.content.some(part => part.type === 'text' && part.text.trim().length > 0);
      return false;
    });
    
    if (!hasValidContent) {
      finalStatus = 400;
      finalError = "Invalid request: messages must contain at least one non-empty content block.";
      res.status(400).json({ error: { message: finalError, type: 'invalid_request_error', requestId } });
      return;
    }

    // --- 1. IDE MODE DETECTION (very fast) ---
    const isIdeMode = ideMode.detectIdeMode(req.headers['user-agent'], req.headers['x-ide-mode']);
    const requestTimeout = isIdeMode ? 5000 : 60000;
    logger.debug({
      component: 'InferenceOS',
      event: 'REQUEST_START',
      requestId,
      isIdeMode,
      hasTools: !!(tools && tools.length > 0)
    });

    // --- 2. FAST PATH LAYER (ultra fast) ---
    const fastPathResult = fastPathLayer.checkFastPath(messages, temperature, tools, tool_choice);
    if (fastPathResult.fastPath) {
      let result = null;
      if (fastPathResult.cachedResponse) {
        cacheHit = true;
        result = fastPathResult.cachedResponse;
      } else if (fastPathResult.trivialResponse) {
        result = fastPathLayer.createTrivialResponse(fastPathResult.trivialResponse);
      }

      if (result) {
        profiler.mark('context');
        profiler.mark('routing');
        profiler.mark('provider');
        profiler.mark('providerEnd');
        const mongoSaveStart = Date.now();
        await logRequest(RequestsModel, userId, 'fast-path', 'fast-path', null, 'success', 
          tokenEstimator.estimateTotalTokens(messages), 
          result.usage?.completion_tokens || 0, 
          Date.now() - profiler.start, null, taskType, 0, requestId);
        profiler.mark('mongo');
        
        const serializeStart = Date.now();
        res.setHeader('X-Cache-Hit', String(cacheHit));
        res.setHeader('X-Latency', Date.now() - profiler.start);
        res.setHeader('X-Task-Type', taskType);
        res.setHeader('X-Request-Id', requestId);
        res.json(result);
        profiler.mark('serialize');
        
        finalStatus = 'success';
        finalError = null;
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
        return;
      }
    }

    // --- 3. CONVERSATION TOKEN BUDGET CHECK ---
    let conversationId;
    const firstUserMsg = messages.find(m => m.role === 'user' && m.content);
    if (firstUserMsg) {
      const contentToHash = typeof firstUserMsg.content === 'string' 
        ? firstUserMsg.content 
        : JSON.stringify(firstUserMsg.content);
      conversationId = crypto.createHash('md5').update(contentToHash.slice(0, 200)).digest('hex');
    } else {
      conversationId = crypto.randomUUID();
    }
    let convBudget = conversationTokenUsage.get(conversationId);
    const now = Date.now();
    if (!convBudget || now - convBudget.createdAt > CONVERSATION_BUDGET_TTL) {
      convBudget = { usedTokens: 0, createdAt: now };
      conversationTokenUsage.set(conversationId, convBudget);
    }
    const estimatedInputTokens = tokenEstimator.estimateTotalTokens(messages);
    const estimatedTotalTokens = estimatedInputTokens + max_tokens;
    if (convBudget.usedTokens + estimatedTotalTokens > CONVERSATION_TOKEN_BUDGET) {
      profiler.mark('context');
      profiler.mark('routing');
      profiler.mark('provider');
      profiler.mark('providerEnd');
      profiler.mark('mongo');
      profiler.mark('serialize');
      finalStatus = 'error';
        finalError = 'Conversation token budget exceeded';
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
      res.status(429).json({
        error: {
          message: `Conversation token budget exceeded (${CONVERSATION_TOKEN_BUDGET} tokens max). Start a new conversation.`,
          type: 'budget_exceeded',
          requestId
        }
      });
      return;
    }

    // --- 4. LAZY ORCHESTRATION START ---
    
    // 4.1 Classify ONLY if NOT in IDE Mode
    if (!isIdeMode) {
      const classification = requestClassifier.classifyRequest(messages);
      taskType = classification.taskType;
      logger.debug({
        component: 'InferenceOS',
        event: 'REQUEST_CLASSIFIED',
        requestId,
        taskType,
        confidence: classification.confidence
      });
    }

    // 4.2 Context Management with Tool Safe Mode if needed
    let alreadyCompressed = false;
    const hasTools = !!(tools && tools.length > 0);
    const tokenBudget = tokenEstimator.getTokenBudget(taskType);
    
    if (isIdeMode) {
      let newMessages = [...messages];
      const ideRulesPrompt = `Tu es un assistant de développement intégré à un IDE.

Tu ne fonctionnes PAS comme un agent autonome en boucle infinie.
Tu ne dois jamais exécuter plusieurs étapes sans validation explicite.

Règles strictes :

1. Une seule réponse = une seule action logique.
   - Pas de plan multi-étapes exécuté automatiquement.
   - Pas de boucle “analyser → coder → corriger → re-tester”.

2. Tu ne dois pas déclencher plusieurs appels implicites.
   - Aucun enchaînement de requêtes internes.
   - Aucun auto-retry.

3. Si une tâche est complexe :
   - Tu proposes un plan court (max 3 étapes)
   - Tu attends confirmation explicite avant de continuer.

4. Optimisation API obligatoire :
   - Réduis les appels inutiles.
   - Préfère une réponse complète unique plutôt que plusieurs petites réponses.

5. Mode IDE :
   - Tu réponds uniquement sur la demande actuelle.
   - Tu n’anticipes pas les étapes suivantes.

6. Gestion des erreurs :
   - Si limitation API ou rate limit apparaît, tu arrêtes immédiatement.
   - Tu ne retries pas automatiquement.

7. Priorité :
   - Minimiser les requêtes API
   - Maximiser la complétude de chaque réponse

Sortie :
- Réponse directe
- Pas d’explication inutile
- Pas de narration`;

      if (newMessages.length > 0 && newMessages[0].role === 'system') {
        newMessages[0] = {
          ...newMessages[0],
          content: ideRulesPrompt + "\n\n" + newMessages[0].content
        };
      } else {
        newMessages.unshift({
          role: 'system',
          content: ideRulesPrompt
        });
      }
      processedMessages = newMessages;
      compressionRatio = 0;
      tokensSaved = 0;
      alreadyCompressed = true;
      profiler.mark('context');
    } else {
      const contextResult = contextManager.manageContext(messages, tokenBudget.input, hasTools);
      processedMessages = contextResult.messages;
      compressionRatio = contextResult.compressionRatio || 0;
      tokensSaved = contextResult.tokensSaved || 0;
      alreadyCompressed = contextResult.compressed;
      profiler.mark('context');

      // Guard: ContextManager must never produce an empty or content-less result
      const hasProcessedContent = processedMessages && processedMessages.length > 0 &&
        processedMessages.some(m => {
          if (typeof m.content === 'string') return m.content.trim().length > 0;
          if (Array.isArray(m.content)) return m.content.some(p => p.type === 'text' && p.text.trim().length > 0);
          return false;
        });
      if (!hasProcessedContent) {
        finalStatus = 400;
        finalError = 'Context compression produced empty messages. Request cannot be processed.';
        res.status(400).json({ error: { message: finalError, type: 'invalid_request_error', requestId } });
        return;
      }
    }
    
    logger.debug({
      component: 'InferenceOS',
      event: 'CONTEXT_MANAGEMENT_COMPLETE',
      requestId,
      hasTools,
      compressionRatio,
      tokensSaved
    });

    // 4.3 Cache check
    const cacheable = !stream && !tools && !tool_choice && (temperature === 0 || temperature === undefined);
    let cacheKey = null;
    if (cacheable) {
      cacheKey = getCacheKey(processedMessages, { temperature, max_tokens, top_p, model: requestedModel });
      const cached = get(cacheKey);
      if (cached) {
        cacheHit = true;
        profiler.mark('routing');
        profiler.mark('provider');
        profiler.mark('providerEnd');
        
        const mongoSaveStart = Date.now();
        await logRequest(RequestsModel, userId, 'cache', 'cached', null, 'success', 
          tokenEstimator.estimateTotalTokens(messages), 
          cached.usage?.completion_tokens || 0, 
          Date.now() - profiler.start, null, taskType, 0, requestId);
        profiler.mark('mongo');
        
        const serializeStart = Date.now();
        res.setHeader('X-Cache-Hit', 'true');
        res.setHeader('X-Latency', Date.now() - profiler.start);
        res.setHeader('X-Task-Type', taskType);
        res.setHeader('X-Request-Id', requestId);
        res.json(cached);
        profiler.mark('serialize');
        
        finalStatus = 'success';
        finalError = null;
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
        return;
      }
    }

    // --- 5. ROUTING ---
    let preferredModel;
    if (isAutoModel(requestedModel)) {
      preferredModel = getStickyModel(messages);
      
      if (!preferredModel) {
        const fallbackChain = await FallbackConfigModel.find({ deletedAt: null, enabled: true })
          .sort({ priority: 1 })
          .lean();
        
        const modelDbIds = fallbackChain.map(entry => entry.modelDbId);
        const allModels = await ModelsModel.find({ _id: { $in: modelDbIds }, enabled: true, deletedAt: null }).lean();
        
        const modelMap = new Map();
        for (const model of allModels) {
          modelMap.set(String(model._id), model);
        }
        
        let candidateModels = [];
        for (const entry of fallbackChain) {
          const model = modelMap.get(String(entry.modelDbId));
          if (model) {
            candidateModels.push({
              ...entry,
              model,
            });
          }
        }
        
        if (candidateModels.length > 0) {
          preferredModel = candidateModels[0].model._id;
        }
      }
    } else if (requestedModel) {
      const enabled = await ModelsModel.findOne({ modelId: requestedModel, enabled: true, deletedAt: null }).lean();
      if (enabled) {
        preferredModel = enabled._id;
      } else {
        const disabled = await ModelsModel.findOne({ modelId: requestedModel, deletedAt: null }).lean();
        const reason = disabled ? 'is disabled' : 'is not in the catalog';
        profiler.mark('routing');
        profiler.mark('provider');
        profiler.mark('providerEnd');
        profiler.mark('mongo');
        profiler.mark('serialize');
        finalStatus = 'error';
        finalError = 'Model ' + requestedModel + ' ' + reason;
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
        res.status(400).json({
          error: {
            message: "Model '" + requestedModel + "' " + reason + ". Use 'auto' (or omit the 'model' field) to auto-route, or call /v1/models for the available list.",
            type: 'invalid_request_error',
            code: 'model_not_found',
            requestId
          },
        });
        return;
      }
    } else {
      preferredModel = getStickyModel(messages);
    }

    const skipKeys = new Set();
    let lastError = null;
    let route = null;

    // --- 6. EXECUTION LOOP ---
    while (fallbackCount <= MAX_FALLBACKS) {
      try {
        route = await routeRequest(
          ModelsModel, 
          ApiKeysModel, 
          FallbackConfigModel, 
          tokenEstimator.estimateTotalTokens(processedMessages) + max_tokens, 
          skipKeys.size > 0 ? skipKeys : undefined, 
          preferredModel,
          taskType,
          isIdeMode,
          !!(tools && tools.length > 0), // hasTools = true si outils présents
          userId // per-account key isolation
        );
        profiler.mark('routing');
        
        keyId = route.keyId;

        // Token limits check
        const tokenCheck = tokenEstimator.checkTokenLimits(
          processedMessages, 
          route.platform, 
          taskType, 
          max_tokens
        );
        
        if (tokenCheck.needsCompression && !alreadyCompressed && !isIdeMode && !hasTools) {
          logger.debug({
            component: 'InferenceOS',
            event: 'NEEDS_FURTHER_COMPRESSION',
            requestId,
            platform: route.platform
          });
          const furtherCompressed = tokenEstimator.compressContext(
            processedMessages, 
            Math.min(tokenCheck.budget.input, tokenCheck.providerLimit - max_tokens)
          );
          processedMessages = furtherCompressed.messages;
          tokensSaved += tokenEstimator.estimateTotalTokens(messages) - furtherCompressed.compressedTokens;
          compressionRatio = 1 - (furtherCompressed.compressedTokens / tokenEstimator.estimateTotalTokens(messages));
        }

        recordRequest(route.platform, route.modelId, route.keyId);

        const requestStart = Date.now();
        profiler.mark('provider');

        try {
          if (stream) {
            let totalOutputTokens = 0;
            let streamStarted = false;
            try {
              const gen = route.provider.streamChatCompletion(
                route.apiKey, processedMessages, route.modelId,
                { 
                  temperature: temperature, 
                  max_tokens: max_tokens, 
                  top_p: top_p, 
                  tools: tools, 
                  tool_choice: tool_choice, 
                  parallel_tool_calls: parallel_tool_calls,
                  timeout: requestTimeout
                },
              );
              
              let firstChunk = true;
              for await (const chunk of gen) {
                if (firstChunk) {
                  profiler.mark('providerStreamStart');
                  firstChunk = false;
                }
                if (!streamStarted) {
                  res.setHeader('Content-Type', 'text/event-stream');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.setHeader('Connection', 'keep-alive');
                  res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
                  res.setHeader('X-Task-Type', taskType);
                  res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
                  res.setHeader('X-Request-Id', requestId);
                  res.setHeader('X-Ide-Mode', String(isIdeMode));
                  streamStarted = true;
                }
                const text = chunk.choices?.[0]?.delta?.content || '';
                totalOutputTokens += Math.ceil(text.length / 4);
                res.write('data: ' + JSON.stringify(chunk) + '\n\n');
              }
              profiler.mark('providerStreamEnd');
              profiler.mark('providerEnd');

              if (!streamStarted) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
              }
              res.write('data: [DONE]\n\n');
              res.end();

              const latency = Date.now() - requestStart;
              const totalTokensUsed = tokenEstimator.estimateTotalTokens(processedMessages) + totalOutputTokens;
              convBudget.usedTokens += totalTokensUsed;
              conversationTokenUsage.set(conversationId, convBudget);
              
              recordTokens(route.platform, route.modelId, route.keyId, totalTokensUsed);
              recordSuccess(route.modelDbId);
              circuitBreaker.recordSuccess(route.platform);
              perfMetrics.recordSuccess(route.platform, route.modelId, latency, 
                tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens);
              keyPoolManager.recordKeySuccess(route.platform, route.keyId, latency);
              setStickyModel(processedMessages, route.modelDbId);
              
              // First save to Mongo and measure that time
              const mongoSaveStart = Date.now();
              await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'success', 
                tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
                latency, null, taskType, fallbackCount, requestId);
              profiler.mark('mongo');
              
              profiler.mark('serialize');
              finalStatus = 'success';
        finalError = null;
        routeContext.platform = route.platform;
        routeContext.modelId = route.modelId;
        tokensContext = {
                  originalInput: tokenEstimator.estimateTotalTokens(messages),
                  processedInput: tokenEstimator.estimateTotalTokens(processedMessages),
                  output: totalOutputTokens,
                  total: totalTokensUsed,
                  saved: tokensSaved,
                  conversationUsed: convBudget.usedTokens
                };
        // logger.request removed
              return;
            } catch (streamErr) {
              if (streamStarted) {
                logger.error({
                  component: 'InferenceOS',
                  event: 'MID_STREAM_ERROR',
                  requestId,
                  platform: route.platform,
                  error: streamErr.message
                });
                const payload = { error: { message: "Provider error (" + route.displayName + "): stream interrupted", type: 'stream_error' } };
                try { res.write('data: ' + JSON.stringify(payload) + '\n\n'); } catch { /* socket gone */ }
                try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* socket gone */ }
                const latency = Date.now() - requestStart;
                const mongoSaveStart = Date.now();
                await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', 
                  tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
                  latency, streamErr.message, taskType, fallbackCount, requestId);
                profiler.mark('mongo');
                profiler.mark('serialize');
                finalStatus = 'error';
        finalError = streamErr.message;
        routeContext.platform = route.platform;
        routeContext.modelId = route.modelId;
        if (null !== null) tokensContext = null;
        // logger.request removed
                return;
              }
              throw streamErr;
            }
          } else {
            const result = await route.provider.chatCompletion(
            route.apiKey, processedMessages, route.modelId,
            { 
              temperature: temperature, 
              max_tokens: max_tokens, 
              top_p: top_p, 
              tools: tools, 
              tool_choice: tool_choice, 
              parallel_tool_calls: parallel_tool_calls,
              timeout: requestTimeout
            },
          );
            profiler.mark('providerEnd');

            const latency = Date.now() - requestStart;
            const totalTokens = result.usage?.total_tokens || 0;
            const inputTokensResult = result.usage?.prompt_tokens || tokenEstimator.estimateTotalTokens(processedMessages);
            const outputTokensResult = result.usage?.completion_tokens || 0;
            
            convBudget.usedTokens += totalTokens;
            conversationTokenUsage.set(conversationId, convBudget);
            
            recordTokens(route.platform, route.modelId, route.keyId, totalTokens);
            recordSuccess(route.modelDbId);
            circuitBreaker.recordSuccess(route.platform);
            perfMetrics.recordSuccess(route.platform, route.modelId, latency, inputTokensResult, outputTokensResult);
            keyPoolManager.recordKeySuccess(route.platform, route.keyId, latency);
            setStickyModel(processedMessages, route.modelDbId);

            res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
            res.setHeader('X-Task-Type', taskType);
            res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
            res.setHeader('X-Latency', latency);
            res.setHeader('X-Request-Id', requestId);
            res.setHeader('X-Ide-Mode', String(isIdeMode));
            
            if (cacheable && cacheKey && fallbackCount === 0) {
              set(cacheKey, result);
            }
            
            // First save to Mongo and measure that time
            const mongoSaveStart = Date.now();
            await logRequest(
              RequestsModel,
              userId,
              route.platform,
              route.modelId,
              route.keyId,
              'success',
              inputTokensResult,
              outputTokensResult,
              latency,
              null,
              taskType,
              fallbackCount,
              requestId
            );
            profiler.mark('mongo');
            
            // Then serialize and send response
            const serializeStart = Date.now();
            res.json(result);
            profiler.mark('serialize');

            finalStatus = 'success';
        finalError = null;
        routeContext.platform = route.platform;
        routeContext.modelId = route.modelId;
        tokensContext = {
                originalInput: tokenEstimator.estimateTotalTokens(messages),
                processedInput: inputTokensResult,
                output: outputTokensResult,
                total: totalTokens,
                saved: tokensSaved,
                conversationUsed: convBudget.usedTokens
              };
        // logger.request removed
            return;
          }
        } catch (err) {
          const latency = Date.now() - requestStart;
          const mongoSaveStart = Date.now();
          await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', 
            tokenEstimator.estimateTotalTokens(processedMessages), 0, latency, 
            err.message, taskType, fallbackCount, requestId);
          profiler.mark('mongo');
          profiler.mark('serialize');

          circuitBreaker.recordFailure(route.platform);
          perfMetrics.recordFailure(route.platform, route.modelId);
          keyPoolManager.recordKeyFailure(route.platform, route.keyId, err.message);
          throw err;
        }
      } catch (err) {
        // IGNORE "this operation was aborted" - they're often user interruptions or timeouts (not true provider failures)
        // DO NOT increment fallbackCount or skip this key!
        if (err.message && err.message.toLowerCase().includes('aborted')) {
          logger.debug({
            component: 'InferenceOS',
            event: 'IGNORE_ABORTED_ERROR',
            requestId,
            platform: route?.platform || 'unknown',
            error: err.message
          });
          lastError = err;
          // Just retry the same key/route, DO NOT count as fallback or skip
          continue;
        }

        // --- CRITICAL ERROR CLASSIFICATION ---
        // Some errors indicate a payload problem (not a provider issue).
        // Retrying with another provider will produce the same result → stop immediately.
        const msg = err.message || '';
        const isCriticalPayloadError = (
          msg.includes('400') &&
          (msg.toLowerCase().includes('contents is not specified') ||
           msg.toLowerCase().includes('invalid argument') ||
           msg.toLowerCase().includes('empty') ||
           msg.toLowerCase().includes('must have at least'))
        );
        const isDeadKeyError = (
          msg.includes('401') ||
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('invalid api key') ||
          msg.toLowerCase().includes('authentication') ||
          msg.includes('403')
        );

        if (isCriticalPayloadError) {
          logger.error({
            component: 'InferenceOS',
            event: 'CRITICAL_PAYLOAD_ERROR',
            requestId,
            platform: route?.platform,
            error: msg
          });
          finalStatus = 400;
          finalError = `Payload error (${route?.platform}): ${msg}`;
          res.status(400).json({
            error: { message: finalError, type: 'invalid_request_error', requestId }
          });
          return;
        }

        if (isDeadKeyError && route) {
          // Dead key: blacklist immediately in keyPool AND skip in this request, but DO allow fallback
          logger.event({
            component: 'InferenceOS',
            event: 'DEAD_KEY_DETECTED',
            requestId,
            platform: route.platform,
            keyId: route.keyId,
            error: msg.slice(0, 100)
          });
          keyPoolManager.recordKeyFailure(route.platform, route.keyId, err.message);
          const skipId = route.platform + ':' + route.modelId + ':' + route.keyId;
          skipKeys.add(skipId);
          lastError = err;
          fallbackCount++;
          continue;
        }

        if (fallbackCount < MAX_FALLBACKS) {
          if (route) {
            const skipId = route.platform + ':' + route.modelId + ':' + route.keyId;
            skipKeys.add(skipId);
            setCooldown(route.platform, route.modelId, route.keyId, 120000);
            recordRateLimitHit(route.modelDbId);
          }
          lastError = err;
          fallbackCount++;
          logger.event({
            component: 'InferenceOS',
            event: 'FALLBACK',
            requestId,
            fallbackCount,
            maxFallbacks: MAX_FALLBACKS,
            error: err.message.slice(0, 100)
          });
          continue;
        }

        logger.error({
          component: 'InferenceOS',
          event: 'ALL_PROVIDERS_EXHAUSTED',
          requestId,
          error: err.message,
          fallbackCount
        });
        finalStatus = lastError && lastError.message.includes('429') ? 429 : 502;
        
        finalError = lastError ? "All models exhausted. Last error: " + lastError.message : "Error: " + err.message;
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
        
        res.status(finalStatus).json({
          error: {
            message: lastError ? "All models exhausted. Last error: " + lastError.message : "Error: " + err.message,
            type: lastError && lastError.message.includes('429') ? 'rate_limit_error' : 'provider_error',
            requestId,
            details: err.response?.data || null
          },
        });
        return;
      }
    }

    profiler.mark('routing');
    profiler.mark('provider');
    profiler.mark('providerEnd');
    profiler.mark('mongo');
    profiler.mark('serialize');
    finalStatus = 'error';
        finalError = "All models exhausted after " + fallbackCount + " attempts. Last: " + (lastError?.message || '');
        routeContext.platform = null;
        routeContext.modelId = null;
        if (null !== null) tokensContext = null;
        // logger.request removed
    res.status(429).json({
      error: {
        message: "All models exhausted after " + fallbackCount + " attempts. Last: " + (lastError?.message || ''),
        type: 'rate_limit_error',
        requestId
      },
    });
    } finally {
      finalizeRequest();
    }
  });

  return router;
}

module.exports = {
  createFreeLLMProxyRouter
};
