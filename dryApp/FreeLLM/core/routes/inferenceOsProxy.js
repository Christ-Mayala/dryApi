const crypto = require('crypto');
const express = require('express');
const { routeRequest, recordRateLimitHit, recordSuccess } = require('../services/router.js');
const { recordRequest, recordTokens, setCooldown } = require('../services/ratelimit.js');
const { getCircuitBreaker } = require('../services/circuitBreaker.js');
const perfMetrics = require('../services/performanceMetrics.js');
const { getCacheKey, get, set } = require('../services/responseCache.js');
const tokenEstimator = require('../services/tokenEstimator.js');
const contextManager = require('../services/contextManager.js');
const requestClassifier = require('../services/requestClassifier.js');
const keyPoolManager = require('../services/keyPoolManager.js');
const fastPathLayer = require('../services/fastPathLayer.js');
const ideMode = require('../services/ideMode.js');
const toolRuntime = require('../services/toolRuntime.js');

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

// DETAILED OBSERVABILITY LOGGING
function logOrchestrationDetails(details) {
  console.log(`[InferenceOS] 📊 ${JSON.stringify(details, null, 2)}`);
}

async function logRequest(RequestsModel, userId, platform, modelId, keyId, status, inputTokens, outputTokens, latencyMs, error, taskType, fallbackCount, requestId) {
  try {
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
      requestId
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

function createFreeLLMProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, unifiedApiKey) {
  const router = express.Router();
  
  // Initialize key pool manager
  keyPoolManager.initializeKeyPool(ApiKeysModel);
  
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
      
      console.log(`[ToolRuntime] Exécution de l'outil: ${tool_name}`);
      
      const result = await toolRuntime.executeToolRequest({
        toolName: tool_name,
        toolArgs: tool_args || {},
        userRequest: user_request || req.body.messages?.map(m => m.content).join('\n') || ''
      });
      
      console.log(`[ToolRuntime] Résultat: ${result.success ? 'Succès' : 'Fallback'}`);
      
      if (result.used_fallback) {
        // Si fallback utilisé, retourner avec statut 200 mais inclure les infos de fallback
        res.status(200).json({
          ...result,
          request_id: requestId
        });
      } else {
        // Succès de l'exécution de l'outil
        res.status(200).json({
          ...result,
          request_id: requestId
        });
      }
    } catch (error) {
      console.error('[ToolRuntime] Erreur:', error);
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
    const overallStart = Date.now();
    const requestId = crypto.randomUUID();
    let fallbackCount = 0;
    let taskType = 'chat';
    let cacheHit = false;
    let compressionRatio = 0;
    let tokensSaved = 0;
    let processedMessages = req.body.messages;
    let keyId = null;

    let userId = null;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const User = req.getModel('User');

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
        res.status(401).json({
          error: { message: 'Invalid API key or JWT token', type: 'authentication_error' },
        });
        return;
      }
    }

    if (!userId) {
      res.status(401).json({
        error: { message: 'Authentication required', type: 'authentication_error' },
      });
      return;
    }

    const requestedModel = req.body.model;
    const temperature = req.body.temperature;
    const max_tokens = req.body.max_tokens || 1000;
    const top_p = req.body.top_p;
    const stream = req.body.stream;
    const tools = req.body.tools;
    const tool_choice = req.body.tool_choice;
    const parallel_tool_calls = req.body.parallel_tool_calls;
    const messages = req.body.messages;

    // --- 1. IDE MODE DETECTION (very fast) ---
    const isIdeMode = ideMode.detectIdeMode(req.headers['user-agent'], req.headers['x-ide-mode']);
    const requestTimeout = isIdeMode ? 5000 : 60000;
    console.log(`[InferenceOS] Request ${requestId} - IDE Mode: ${isIdeMode}`);

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
        const latency = Date.now() - overallStart;
        res.setHeader('X-Cache-Hit', String(cacheHit));
        res.setHeader('X-Latency', latency);
        res.setHeader('X-Task-Type', taskType);
        res.setHeader('X-Request-Id', requestId);
        await logRequest(RequestsModel, userId, 'fast-path', 'fast-path', null, 'success', 
          tokenEstimator.estimateTotalTokens(messages), 
          result.usage?.completion_tokens || 0, 
          latency, null, taskType, 0, requestId);
        
        const details = {
          requestId,
          taskType,
          status: 'success',
          path: 'fast-path',
          cacheHit,
          latency,
          isIdeMode
        };
        logOrchestrationDetails(details);
        
        res.json(result);
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
      console.warn(`[InferenceOS] Conversation budget exceeded for ${conversationId}: used=${convBudget.usedTokens}, estimated=${estimatedTotalTokens}, budget=${CONVERSATION_TOKEN_BUDGET}`);
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
      console.log(`[InferenceOS] Classified request: ${taskType} (confidence: ${classification.confidence.toFixed(2)})`);
    }

    // 4.2 Context Management ONLY if NOT in IDE Mode AND NO TOOLS
    let alreadyCompressed = false;
    const hasTools = !!(tools && tools.length > 0);
    if (!isIdeMode && !hasTools) {
      const tokenBudget = tokenEstimator.getTokenBudget(taskType);
      const contextResult = contextManager.manageContext(messages, tokenBudget.input);
      processedMessages = contextResult.messages;
      compressionRatio = contextResult.compressionRatio || 0;
      tokensSaved = contextResult.tokensSaved || 0;
      alreadyCompressed = contextResult.compressed;
      
      if (alreadyCompressed) {
        console.log(`[InferenceOS] Compressed context: ${(compressionRatio * 100).toFixed(1)}% reduction, saved ${tokensSaved} tokens`);
      }
    } else if (hasTools) {
      console.log(`[InferenceOS] Tools detected - skipping context management to preserve tool sequence integrity.`);
    }

    // 4.3 Cache check
    const cacheable = !stream && !tools && !tool_choice && (temperature === 0 || temperature === undefined);
    let cacheKey = null;
    if (cacheable) {
      cacheKey = getCacheKey(processedMessages, { temperature, max_tokens, top_p, model: requestedModel });
      const cached = get(cacheKey);
      if (cached) {
        cacheHit = true;
        const latency = Date.now() - overallStart;
        res.setHeader('X-Cache-Hit', 'true');
        res.setHeader('X-Latency', latency);
        res.setHeader('X-Task-Type', taskType);
        res.setHeader('X-Request-Id', requestId);
        await logRequest(RequestsModel, userId, 'cache', 'cached', null, 'success', 
          tokenEstimator.estimateTotalTokens(messages), 
          cached.usage?.completion_tokens || 0, 
          latency, null, taskType, 0, requestId);
        
        logOrchestrationDetails({
          requestId,
          taskType,
          status: 'success',
          path: 'cache',
          cacheHit,
          latency,
          isIdeMode
        });
        
        res.json(cached);
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
          !!(tools && tools.length > 0) // hasTools = true si outils présents
        );
        
        keyId = route.keyId;

        // Token limits check
        const tokenCheck = tokenEstimator.checkTokenLimits(
          processedMessages, 
          route.platform, 
          taskType, 
          max_tokens
        );
        
        if (tokenCheck.needsCompression && !alreadyCompressed && !isIdeMode) {
          console.log(`[InferenceOS] Token limits exceeded for ${route.platform}, compressing`);
          const furtherCompressed = tokenEstimator.compressContext(
            processedMessages, 
            Math.min(tokenCheck.budget.input, tokenCheck.providerLimit - max_tokens)
          );
          processedMessages = furtherCompressed.messages;
          tokensSaved += tokenEstimator.estimateTotalTokens(messages) - furtherCompressed.compressedTokens;
          compressionRatio = 1 - (furtherCompressed.compressedTokens / tokenEstimator.estimateTotalTokens(messages));
        }

        recordRequest(route.platform, route.modelId, route.keyId);

        const cbKey = `${route.platform}:${route.modelId}`;
        const circuitBreaker = getCircuitBreaker(cbKey);
        const requestStart = Date.now();

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

              for await (const chunk of gen) {
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
              circuitBreaker.recordSuccess();
              perfMetrics.recordSuccess(route.platform, route.modelId, latency, 
                tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens);
              keyPoolManager.recordKeySuccess(route.platform, route.keyId, latency);
              setStickyModel(processedMessages, route.modelDbId);
              
              logOrchestrationDetails({
                requestId,
                conversationId,
                taskType,
                platform: route.platform,
                model: route.modelId,
                keyId,
                status: 'success',
                path: 'orchestrated',
                latency,
                tokens: {
                  originalInput: tokenEstimator.estimateTotalTokens(messages),
                  processedInput: tokenEstimator.estimateTotalTokens(processedMessages),
                  output: totalOutputTokens,
                  total: totalTokensUsed,
                  saved: tokensSaved,
                  conversationUsed: convBudget.usedTokens
                },
                compression: compressionRatio,
                fallbackCount,
                cacheHit,
                isIdeMode
              });
              
              await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'success', 
                tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
                latency, null, taskType, fallbackCount, requestId);
              return;
            } catch (streamErr) {
              if (streamStarted) {
                console.error('[InferenceOS] Mid-stream error from ' + route.displayName + ':', streamErr.message);
                const payload = { error: { message: "Provider error (" + route.displayName + "): stream interrupted", type: 'stream_error' } };
                try { res.write('data: ' + JSON.stringify(payload) + '\n\n'); } catch { /* socket gone */ }
                try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* socket gone */ }
                const latency = Date.now() - requestStart;
                await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', 
                  tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
                  latency, streamErr.message, taskType, fallbackCount, requestId);
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

            const latency = Date.now() - requestStart;
            const totalTokens = result.usage?.total_tokens || 0;
            const inputTokensResult = result.usage?.prompt_tokens || tokenEstimator.estimateTotalTokens(processedMessages);
            const outputTokensResult = result.usage?.completion_tokens || 0;
            
            convBudget.usedTokens += totalTokens;
            conversationTokenUsage.set(conversationId, convBudget);
            
            recordTokens(route.platform, route.modelId, route.keyId, totalTokens);
            recordSuccess(route.modelDbId);
            circuitBreaker.recordSuccess();
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
            
            res.json(result);

            logOrchestrationDetails({
              requestId,
              conversationId,
              taskType,
              platform: route.platform,
              model: route.modelId,
              keyId,
              status: 'success',
              path: 'orchestrated',
              latency,
              tokens: {
                originalInput: tokenEstimator.estimateTotalTokens(messages),
                processedInput: inputTokensResult,
                output: outputTokensResult,
                total: totalTokens,
                saved: tokensSaved,
                conversationUsed: convBudget.usedTokens
              },
              compression: compressionRatio,
              fallbackCount,
              cacheHit,
              isIdeMode
            });

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
            return;
          }
        } catch (err) {
          const latency = Date.now() - requestStart;
          await logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', 
            tokenEstimator.estimateTotalTokens(processedMessages), 0, latency, 
            err.message, taskType, fallbackCount, requestId);

          circuitBreaker.recordFailure();
          perfMetrics.recordFailure(route.platform, route.modelId);
          keyPoolManager.recordKeyFailure(route.platform, route.keyId, err.message);
          throw err;
        }
      } catch (err) {
        // IGNORE "this operation was aborted" - they're often user interruptions or timeouts (not true provider failures)
        // DO NOT increment fallbackCount or skip this key!
        if (err.message && err.message.toLowerCase().includes('aborted')) {
          console.warn(`[InferenceOS] Ignoring aborted error for ${route?.platform || 'unknown'}:`, err.message);
          lastError = err;
          // Just retry the same key/route, DO NOT count as fallback or skip
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
          console.log(`[InferenceOS] ${err.message.slice(0, 60)}, fallback ${fallbackCount}/${MAX_FALLBACKS}`);
          continue;
        }

        console.error('[InferenceOS] Provider error:', err.message, err.response?.data);
        const finalStatus = lastError && lastError.message.includes('429') ? 429 : 502;
        
        logOrchestrationDetails({
          requestId,
          taskType,
          status: 'error',
          error: err.message,
          fallbackCount,
          isIdeMode
        });
        
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

    res.status(429).json({
      error: {
        message: "All models exhausted after " + fallbackCount + " attempts. Last: " + (lastError?.message || ''),
        type: 'rate_limit_error',
        requestId
      },
    });
  });

  return router;
}

module.exports = {
  createFreeLLMProxyRouter
};
