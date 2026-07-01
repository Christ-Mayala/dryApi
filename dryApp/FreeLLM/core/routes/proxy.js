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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RETRY_POLICY = {
  timeout: 0, // ZERO retries for timeout (évite les cascades)
  '429': 0,    // ZERO retries for rate limit
  '503': 0,    // ZERO retries for service unavailable
  network: 0,  // ZERO retries for network errors
  default: 0   // ZERO retries by default
};

const MAX_RETRIES = 0; // NO MORE RETRIES AT ALL TO PREVENT CASCADES
const MAX_FALLBACKS = 1; // MAX 1 FALLBACK PROVIDER
const BASE_BACKOFF_MS = 1000;

// GLOBAL RUNTIME TOKEN BUDGET PER CONVERSATION
const CONVERSATION_TOKEN_BUDGET = 100000; // 100k tokens max par conversation
const conversationTokenUsage = new Map(); // Map<convId, {usedTokens: number, createdAt: number}>
const CONVERSATION_BUDGET_TTL = 3600000 * 24; // 24 hours

function getRetryCountForError(error) {
  const msg = (error.message || '').toLowerCase();
  
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return RETRY_POLICY.timeout;
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return RETRY_POLICY['429'];
  }
  if (msg.includes('503') || msg.includes('unavailable')) {
    return RETRY_POLICY['503'];
  }
  if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('dns')) {
    return RETRY_POLICY.network;
  }
  
  return RETRY_POLICY.default;
}

function isRetryableError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
    || msg.includes('quota') || msg.includes('resource_exhausted')
    || msg.includes('aborted') || msg.includes('timeout') || msg.includes('etimedout')
    || msg.includes('econnrefused') || msg.includes('econnreset')
    || msg.includes('503') || msg.includes('unavailable')
    || msg.includes('500') || msg.includes('internal server error');
}

// DETAILED OBSERVABILITY LOGGING
function logOrchestrationDetails(details) {
  console.log(`[Orchestrator] 📊 ${JSON.stringify(details, null, 2)}`);
}

async function logRequest(RequestsModel, userId, platform, modelId, status, inputTokens, outputTokens, latencyMs, error, taskType, retryCount) {
  try {
    await RequestsModel.create({
      userId,
      platform: platform,
      modelId: modelId,
      status: status,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      latencyMs: latencyMs,
      error: error,
      taskType: taskType,
      retryCount: retryCount
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

function createFreeLLMProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, unifiedApiKey) {
  const router = express.Router();
  
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
          name: 'Auto (router picks the best available model)',
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

  router.post('/chat/completions', async (req, res) => {
    const overallStart = Date.now();
    let retryCount = 0;
    let taskType = 'chat';
    let cacheHit = false;
    let compressionRatio = 0;
    let tokensSaved = 0;

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

    // GLOBAL CONVERSATION TOKEN BUDGET CHECK
    // Generate conversation ID from first user message content for consistency
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
      console.warn(`[Orchestrator] Conversation budget exceeded for ${conversationId}: used=${convBudget.usedTokens}, estimated=${estimatedTotalTokens}, budget=${CONVERSATION_TOKEN_BUDGET}`);
      res.status(429).json({
        error: {
          message: `Conversation token budget exceeded (${CONVERSATION_TOKEN_BUDGET} tokens max). Start a new conversation.`,
          type: 'budget_exceeded'
        }
      });
      return;
    }
    console.log(`[Orchestrator] Conversation ${conversationId} token usage: ${convBudget.usedTokens}/${CONVERSATION_TOKEN_BUDGET} (+${estimatedTotalTokens} est.)`);

    // Classify request
    const classification = requestClassifier.classifyRequest(messages);
    taskType = classification.taskType;
    console.log(`[Orchestrator] Classified request: ${taskType} (confidence: ${classification.confidence.toFixed(2)})`);

    // Token estimation & context management
    const tokenBudget = tokenEstimator.getTokenBudget(taskType);
    const contextResult = contextManager.manageContext(messages, tokenBudget.input);
    let processedMessages = contextResult.messages;
    compressionRatio = contextResult.compressionRatio || 0;
    tokensSaved = contextResult.tokensSaved || 0;
    const alreadyCompressed = contextResult.compressed;
    
    if (alreadyCompressed) {
      console.log(`[Orchestrator] Compressed context: ${(compressionRatio * 100).toFixed(1)}% reduction, saved ${tokensSaved} tokens`);
    }

    // Cache check
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
        await logRequest(RequestsModel, userId, 'cache', 'cached', 'success', 
          tokenEstimator.estimateTotalTokens(messages), 
          cached.usage?.completion_tokens || 0, 
          latency, null, taskType, 0);
        res.json(cached);
        return;
      }
    }

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
        
        const candidateModels = [];
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
          },
        });
        return;
      }
    } else {
      preferredModel = getStickyModel(messages);
    }

    const skipKeys = new Set();
    let lastError = null;

    let fallbackCount = 0;
  for (let attempt = 0; fallbackCount <= MAX_FALLBACKS; attempt++) {
    retryCount = attempt;
    let route;
      try {
        route = await routeRequest(
          ModelsModel, 
          ApiKeysModel, 
          FallbackConfigModel, 
          tokenEstimator.estimateTotalTokens(processedMessages) + max_tokens, 
          skipKeys.size > 0 ? skipKeys : undefined, 
          preferredModel,
          taskType
        );
      } catch (err) {
        if (lastError) {
          res.status(429).json({
            error: {
              message: "All models exhausted. Last error: " + lastError.message,
              type: 'rate_limit_error',
            },
          });
        } else {
          res.status(err.status || 503).json({
            error: { message: err.message, type: 'routing_error' },
          });
        }
        await logRequest(RequestsModel, userId, 'unknown', 'unknown', 'error', 
          tokenEstimator.estimateTotalTokens(messages), 0, Date.now() - overallStart, 
          err.message, taskType, retryCount);
        return;
      }

      // Check token limits for selected provider
      const tokenCheck = tokenEstimator.checkTokenLimits(
        processedMessages, 
        route.platform, 
        taskType, 
        max_tokens
      );
      
      // ONLY compress if NOT already compressed by context manager to avoid double compression
      if (tokenCheck.needsCompression && !alreadyCompressed) {
        console.log(`[Orchestrator] Token limits exceeded for ${route.platform}, compressing`);
        const furtherCompressed = tokenEstimator.compressContext(
          processedMessages, 
          Math.min(tokenCheck.budget.input, tokenCheck.providerLimit - max_tokens)
        );
        processedMessages = furtherCompressed.messages;
        tokensSaved += tokenEstimator.estimateTotalTokens(messages) - furtherCompressed.compressedTokens;
        compressionRatio = 1 - (furtherCompressed.compressedTokens / tokenEstimator.estimateTotalTokens(messages));
      } else if (tokenCheck.needsCompression && alreadyCompressed) {
        console.log(`[Orchestrator] Token limits exceeded for ${route.platform} but context already compressed - skipping further compression to avoid info loss`);
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
              { temperature: temperature, max_tokens: max_tokens, top_p: top_p, tools: tools, tool_choice: tool_choice, parallel_tool_calls: parallel_tool_calls },
            );

            for await (const chunk of gen) {
              if (!streamStarted) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
                res.setHeader('X-Task-Type', taskType);
                res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
                if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
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
            setStickyModel(processedMessages, route.modelDbId);
            const orchestrationDetails = {
              conversationId,
              taskType,
              platform: route.platform,
              model: route.modelId,
              status: 'success',
              latency,
              tokens: {
                originalInput: tokenEstimator.estimateTotalTokens(messages),
                processedInput: tokenEstimator.estimateTotalTokens(processedMessages),
                output: totalOutputTokens,
                total: tokenEstimator.estimateTotalTokens(processedMessages) + totalOutputTokens,
                saved: tokensSaved
              },
              compression: compressionRatio,
              conversationBudget: {
                used: convBudget.usedTokens,
                budget: CONVERSATION_TOKEN_BUDGET
              },
              fallbackCount,
              cacheHit
            };
            logOrchestrationDetails(orchestrationDetails);
            
            await logRequest(RequestsModel, userId, route.platform, route.modelId, 'success', 
              tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
              latency, null, taskType, retryCount);
            return;
          } catch (streamErr) {
            if (streamStarted) {
              console.error('[Proxy] Mid-stream error from ' + route.displayName + ':', streamErr.message);
              const payload = { error: { message: "Provider error (" + route.displayName + "): stream interrupted", type: 'stream_error' } };
              try { res.write('data: ' + JSON.stringify(payload) + '\n\n'); } catch { /* socket gone */ }
              try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* socket gone */ }
              const latency = Date.now() - requestStart;
              await logRequest(RequestsModel, userId, route.platform, route.modelId, 'error', 
                tokenEstimator.estimateTotalTokens(processedMessages), totalOutputTokens, 
                latency, streamErr.message, taskType, retryCount);
              return;
            }
            throw streamErr;
          }
        } else {
          const result = await route.provider.chatCompletion(
          route.apiKey, processedMessages, route.modelId,
          { temperature: temperature, max_tokens: max_tokens, top_p: top_p, tools: tools, tool_choice: tool_choice, parallel_tool_calls: parallel_tool_calls },
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
        setStickyModel(processedMessages, route.modelDbId);

          res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
          res.setHeader('X-Task-Type', taskType);
          res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
          res.setHeader('X-Latency', latency);
          if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
          
          // Store in cache
          if (cacheable && cacheKey && attempt === 0) {
            set(cacheKey, result);
          }
          
          res.json(result);

          const orchestrationDetails = {
            conversationId,
            taskType,
            platform: route.platform,
            model: route.modelId,
            status: 'success',
            latency,
            tokens: {
              originalInput: tokenEstimator.estimateTotalTokens(messages),
              processedInput: inputTokensResult,
              output: outputTokensResult,
              total: totalTokens,
              saved: tokensSaved
            },
            compression: compressionRatio,
            conversationBudget: {
              used: convBudget.usedTokens,
              budget: CONVERSATION_TOKEN_BUDGET
            },
            fallbackCount,
            cacheHit
          };
          logOrchestrationDetails(orchestrationDetails);

          await logRequest(
            RequestsModel,
            userId,
            route.platform,
            route.modelId,
            'success',
            inputTokensResult,
            outputTokensResult,
            latency,
            null,
            taskType,
            retryCount
          );
          return;
        }
      } catch (err) {
        const latency = Date.now() - requestStart;
        await logRequest(RequestsModel, userId, route.platform, route.modelId, 'error', 
          tokenEstimator.estimateTotalTokens(processedMessages), 0, latency, 
          err.message, taskType, retryCount);

        circuitBreaker.recordFailure();
        perfMetrics.recordFailure(route.platform, route.modelId);

      if (fallbackCount < MAX_FALLBACKS) {
        const skipId = route.platform + ':' + route.modelId + ':' + route.keyId;
        skipKeys.add(skipId);
        setCooldown(route.platform, route.modelId, route.keyId, 120000);
        recordRateLimitHit(route.modelDbId);
        lastError = err;
        fallbackCount++;
        console.log(`[Orchestrator] ${err.message.slice(0, 60)} from ${route.displayName}, fallback ${fallbackCount}/${MAX_FALLBACKS}`);
        continue;
        }

        console.error('[Proxy] Provider error:', err.message, err.response?.data);
        res.status(502).json({
          error: {
            message: "Provider error (" + route.displayName + "): " + err.message,
            type: 'provider_error',
            details: err.response?.data || null
          },
        });
        return;
      }
    }

    res.status(429).json({
      error: {
        message: "All models exhausted after " + retryCount + " attempts. Last: " + (lastError?.message || ''),
        type: 'rate_limit_error',
      },
    });
  });

  return router;
}

module.exports = {
  createFreeLLMProxyRouter
};
