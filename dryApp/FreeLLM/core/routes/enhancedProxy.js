/**
 * Enhanced Proxy — Intègre tous les nouveaux modules dans le flux de /v1/chat/completions.
 *
 * Ce module wraps le flux existant avec :
 *   - Error Classifier (classification intelligente des erreurs)
 *   - Response Validator (validation des réponses provider)
 *   - Circuit Breaker V2 (3 états, exponential recovery)
 *   - Provider Health Monitor (suivi continu)
 *   - Degraded Mode (mode dégradé si tous providers down)
 *   - Fallback Engine hiérarchique (6 niveaux)
 *   - Policy Engine (rules configurables)
 *   - Quota Engine (suivi quotas)
 *   - Smart Retry (backoff exponentiel, jitter, budget)
 *   - Model Capability Registry (routing par capabilities)
 *
 * L'architecture existante (router.js, keyPoolManager, etc.) est PRÉSERVÉE.
 * Ce module ajoute une couche par-dessus sans casser l'existant.
 */

const crypto = require('crypto');
const express = require('express');
const { routeRequest, recordRateLimitHit, recordSuccess } = require('../services/router.js');
const { recordRequest, recordTokens, setCooldown } = require('../services/ratelimit.js');
const perfMetrics = require('../services/performanceMetrics.js');
const { getCacheKey, get, set } = require('../services/responseCache.js');
const tokenEstimator = require('../services/tokenEstimator.js');
const contextManager = require('../services/contextManager.js');
const { tokenOptimization, analyzeTokens } = require('../services/tokenOptimization.js');
const requestClassifier = require('../services/requestClassifier.js');
const keyPoolManager = require('../services/keyPoolManager.js');
const fastPathLayer = require('../services/fastPathLayer.js');
const ideMode = require('../services/ideMode.js');
const toolRuntime = require('../services/toolRuntime.js');
const { createProfiler, logger } = require('../services/inferenceLogger.js');

// ─── NEW MODULES ─────────────────────────────────────────────
const { classifyError } = require('../services/errorClassifier.js');
const { validateResponse, sanitizeResponse } = require('../services/responseValidator.js');
const cbV2 = require('../services/circuitBreaker.js');
const { monitor: healthMonitor } = require('../services/providerHealthMonitor.js');
const { degradedMode } = require('../services/degradedMode.js');
const { buildRequirementsFromRequest } = require('../services/fallbackEngine.js');
const policyEngine = require('../services/policyEngine.js');
const { quotaEngine } = require('../services/quotaEngine.js');
const { RetryState, wait } = require('../services/smartRetry.js');
const capabilityRegistry = require('../services/modelCapabilityRegistry.js');
const { meshRoute, recordMeshResult, syncMeshWithDB } = require('../services/meshRoute.js');
const { credentialIntelligence } = require('../services/credentialIntelligence.js');
const { requestAttemptRegistry } = require('../services/requestAttemptRegistry.js');
// ─────────────────────────────────────────────────────────────

const AUTO_MODEL_ID = 'auto';

function isAutoModel(modelId) {
  return modelId === AUTO_MODEL_ID;
}
const MAX_FALLBACKS = 4;
const CONVERSATION_TOKEN_BUDGET = 1_000_000;
const FALLBACK_GLOBAL_TIMEOUT_MS = 60_000;
const conversationTokenUsage = new Map();
const CONVERSATION_BUDGET_TTL = 86_400_000;

// ─── PII Sanitization (preserved from original) ──────────────
function sanitizeMessageContent(content) {
  if (typeof content !== 'string') return content;
  let s = content;
  s = s.replace(/(\+?243|00243)\s?[6-9]\d[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, '[NUMÉRO]');
  s = s.replace(/(\+?242|00242)\s?[0-9]\d[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, '[NUMÉRO]');
  s = s.replace(/\+?\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g, '[NUMÉRO]');
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  s = s.replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[COMPTE]');
  return s;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(msg => {
    if (!msg) return msg;
    if (typeof msg.content === 'string') return { ...msg, content: sanitizeMessageContent(msg.content) };
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map(part => {
          if (part?.type === 'text' && typeof part.text === 'string') return { ...part, text: sanitizeMessageContent(part.text) };
          return part;
        }),
      };
    }
    return msg;
  });
}

function sanitizeProviderResponse(result) {
  if (!result || !result.choices || !Array.isArray(result.choices)) return result;
  return {
    ...result,
    choices: result.choices.map(choice => {
      if (!choice || !choice.message) return choice;
      const content = typeof choice.message.content === 'string' ? choice.message.content : choice.message.content;
      if (typeof content !== 'string') return choice;
      const cleaned = content
        .replace(/\[CONTACT\]/gi, '[UTILISATEUR]')
        .replace(/\[NUMÉRO\]/gi, '[NUMÉRO]')
        .replace(/\[EMAIL\]/gi, '[EMAIL]')
        .replace(/\[COMPTE\]/gi, '[COMPTE]');
      return { ...choice, message: { ...choice.message, content: cleaned } };
    })
  };
}

function sanitizeStreamChunk(chunk) {
  if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) return chunk;
  return {
    ...chunk,
    choices: chunk.choices.map(choice => {
      if (!choice || !choice.delta) return choice;
      const content = choice.delta.content;
      if (typeof content !== 'string') return choice;
      const cleaned = content
        .replace(/\[CONTACT\]/gi, '[UTILISATEUR]')
        .replace(/\[NUMÉRO\]/gi, '[NUMÉRO]')
        .replace(/\[EMAIL\]/gi, '[EMAIL]')
        .replace(/\[COMPTE\]/gi, '[COMPTE]');
      return { ...choice, delta: { ...choice.delta, content: cleaned } };
    })
  };
}
// ─────────────────────────────────────────────────────────────

function timingSafeStringEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const compareA = a.length === b.length ? a : Buffer.alloc(b.length);
  return crypto.timingSafeEqual(compareA, b) && a.length === b.length;
}

// Sticky session map
const stickySessionMap = new Map();
const STICKY_TTL_MS = 30 * 60 * 1000;

function getSessionKey(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '';
  let contentToHash;
  if (typeof firstUser.content === 'string') contentToHash = firstUser.content;
  else if (Array.isArray(firstUser.content)) contentToHash = JSON.stringify(firstUser.content);
  else return '';
  const hash = crypto.createHash('sha1').update(contentToHash).digest('hex');
  return hash + ':' + (messages.length > 2 ? 'multi' : 'single');
}

function getStickyModel(messages) {
  if (!messages.some(m => m.role === 'assistant')) return undefined;
  const key = getSessionKey(messages);
  if (!key) return undefined;
  const entry = stickySessionMap.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.lastUsed > STICKY_TTL_MS) { stickySessionMap.delete(key); return undefined; }
  return entry.modelDbId;
}

function setStickyModel(messages, modelDbId) {
  const key = getSessionKey(messages);
  if (!key) return;
  stickySessionMap.set(key, { modelDbId, lastUsed: Date.now() });
  if (stickySessionMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of stickySessionMap.entries()) { if (now - v.lastUsed > STICKY_TTL_MS) stickySessionMap.delete(k); }
  }
}

// ─── Fallback Metrics ────────────────────────────────────────
const fallbackMetrics = { totalRequests: 0, totalFallbacks: 0, providerStats: new Map() };

async function logRequest(RequestsModel, userId, platform, modelId, keyId, status, inputTokens, outputTokens, latencyMs, error, taskType, fallbackCount, requestId) {
  try {
    await RequestsModel.create({
      userId, platform, modelId, keyId, status, inputTokens, outputTokens,
      latencyMs, error, taskType, fallbackCount, requestId,
      slug: `${platform}-${crypto.randomUUID()}`
    });
  } catch (e) {
    logger.error({ component: 'EnhancedProxy', event: 'LOG_REQUEST_FAILED', requestId, error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// ENHANCED PROXY ROUTER
// ═══════════════════════════════════════════════════════════════

function createEnhancedProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, unifiedApiKey) {
  const router = express.Router();

  // Initialize systems
  keyPoolManager.initializeKeyPool(ApiKeysModel);
  keyPoolManager.setApiKeysModel(ApiKeysModel);

  // ─── GET /models (preserved) ─────────────────────────────
  router.get('/models', async (req, res) => {
    const models = await ModelsModel.find({ enabled: true, deletedAt: null })
      .sort({ intelligenceRank: 1 }).lean();
    res.json({
      object: 'list',
      data: [
        { id: AUTO_MODEL_ID, object: 'model', created: 0, owned_by: 'freellmapi', name: 'Auto (Enhanced Inference OS)', context_window: 128000 },
        ...models.map(m => ({ id: m.modelId, object: 'model', created: 0, owned_by: m.platform, name: m.displayName, context_window: m.contextWindow || 32768 })),
      ],
    });
  });

  // ─── GET /tools (preserved) ──────────────────────────────
  router.get('/tools', (req, res) => {
    res.json({ object: 'list', data: toolRuntime.getAvailableTools().map(n => ({ name: n, type: 'tool' })), request_id: crypto.randomUUID() });
  });

  // ─── GET /health/enhanced (NEW) ──────────────────────────
  router.get('/health/enhanced', (req, res) => {
    res.json({
      circuitBreakers: cbV2.getAllStatus(),
      healthMonitor: healthMonitor.getAllHealth(),
      degradedMode: degradedMode.getStatus(),
      policies: policyEngine.getActiveRules(),
      quotas: quotaEngine.getAllProviderQuotas(),
    });
  });

  // ─── POST /chat/completions (ENHANCED) ───────────────────
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

    const retryState = new RetryState({ maxRetries: MAX_FALLBACKS });
    const capabilityRequirements = buildRequirementsFromRequest(req.body);

    try {
      // ═══ STEP 0: DEGRADED MODE CHECK ═══
      const allProviders = Array.from(new Set(
        (await ModelsModel.find({ enabled: true, deletedAt: null }).lean()).map(m => m.platform)
      ));
      const degradedState = degradedMode.evaluateState(allProviders);

      if (degradedMode.isOffline()) {
        profiler.mark('auth'); profiler.mark('context'); profiler.mark('routing');
        profiler.mark('provider'); profiler.mark('providerEnd'); profiler.mark('mongo'); profiler.mark('serialize');
        const offlineResponse = degradedMode.generateOfflineResponse(req.body.messages || [], requestId);
        res.json(offlineResponse);
        return;
      }

      // ═══ STEP 1: AUTH ═══
      let userId = null;
      let allowSharedKeysFallback = false;
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const User = req.getModel('User');

      if (token && timingSafeStringEqual(token, unifiedApiKey)) {
        const admin = await User.findOne({ role: 'admin' }).lean();
        userId = admin ? admin._id : null;
        if (!userId) { const first = await User.findOne().lean(); userId = first ? first._id : null; }
        allowSharedKeysFallback = true;
      } else if (token) {
        try {
          const { verifyToken } = require('../../../../dry/utils/auth/jwt.util');
          const decoded = verifyToken(token);
          userId = decoded.id;
        } catch (err) {
          profiler.mark('auth');
          res.status(401).json({ error: { message: 'Invalid API key or JWT token', type: 'authentication_error' } });
          return;
        }
      }

      if (!userId) {
        profiler.mark('auth');
        res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
        return;
      }
      profiler.mark('auth');

      // ═══ STEP 2: REQUEST VALIDATION ═══
      const messages = req.body.messages;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: { message: "'messages' array is required", type: 'invalid_request_error', requestId } });
        return;
      }

      const requestedModel = req.body.model;
      const temperature = req.body.temperature;
      const max_tokens = req.body.max_tokens || 1000;
      const top_p = req.body.top_p;
      const stream = req.body.stream;
      const tools = req.body.tools;
      const tool_choice = req.body.tool_choice;

      // ═══ STEP 3: IDE MODE + FAST PATH ═══
      const isIdeMode = ideMode.detectIdeMode(req.headers['user-agent'], req.headers['x-ide-mode']);
      const requestTimeout = isIdeMode ? 5000 : 60000;

      const fastPathResult = fastPathLayer.checkFastPath(messages, temperature, tools, tool_choice);
      if (fastPathResult.fastPath) {
        let result = null;
        if (fastPathResult.cachedResponse) { cacheHit = true; result = fastPathResult.cachedResponse; }
        else if (fastPathResult.trivialResponse) { result = fastPathLayer.createTrivialResponse(fastPathResult.trivialResponse); }

        if (result) {
          profiler.mark('context'); profiler.mark('routing'); profiler.mark('provider');
          profiler.mark('providerEnd'); profiler.mark('mongo'); profiler.mark('serialize');
          logRequest(RequestsModel, userId, 'fast-path', 'fast-path', null, 'success',
            tokenEstimator.estimateTotalTokens(messages), result.usage?.completion_tokens || 0,
            Date.now() - profiler.start, null, taskType, 0, requestId);
          res.setHeader('X-Cache-Hit', String(cacheHit));
          res.setHeader('X-Latency', Date.now() - profiler.start);
          res.setHeader('X-Request-Id', requestId);
          res.json(sanitizeProviderResponse(result));
          return;
        }
      }

      // ═══ STEP 4: CLASSIFY + CONTEXT ═══
      if (!isIdeMode) {
        const classification = requestClassifier.classifyRequest(messages);
        taskType = classification.taskType;
      }

      const hasTools = !!(tools && tools.length > 0);
      const tokenBudget = tokenEstimator.getTokenBudget(taskType);

      if (isIdeMode) {
        const newMessages = [...messages];
        const ideRulesPrompt = `Tu es un assistant de développement intégré à un IDE. Une seule réponse = une seule action logique. Pas de boucle infinie. Réponds directement.`;
        if (newMessages[0]?.role === 'system') {
          newMessages[0] = { ...newMessages[0], content: ideRulesPrompt + "\n\n" + newMessages[0].content };
        } else {
          newMessages.unshift({ role: 'system', content: ideRulesPrompt });
        }
        processedMessages = newMessages;
        compressionRatio = 0; tokensSaved = 0;
      } else {
        const contextResult = contextManager.manageContext(messages, tokenBudget.input, hasTools);
        processedMessages = contextResult.messages;
        compressionRatio = contextResult.compressionRatio || 0;
        tokensSaved = contextResult.tokensSaved || 0;
      }
      profiler.mark('context');

      // ═══ STEP 4b: TOKEN OPTIMIZATION ENGINE ═══
      let tokenOptMetrics = {};
      try {
        const tokenOptResult = tokenOptimization.optimize(processedMessages, {
          requestId,
          provider: null,
          model: requestedModel,
          taskType,
          maxOutputTokens: max_tokens,
        });
        if (tokenOptResult.metrics.tokensSaved > 0) {
          processedMessages = tokenOptResult.messages;
          tokenOptMetrics = tokenOptResult.metrics;
          tokensSaved += tokenOptResult.metrics.tokensSaved;
          compressionRatio = tokenOptResult.metrics.compressionRatioRaw || compressionRatio;
        }
      } catch (optErr) {
        // Safety: optimization failure ≠ request failure
        logger.debug({ component: 'TokenOptimization', event: 'OPT_FAILED', requestId, error: optErr.message });
      }
      const inputTokens = tokenEstimator.estimateTotalTokens(processedMessages);

      // ═══ STEP 5: CONVERSATION BUDGET ═══
      let conversationId;
      const firstUserMsg = messages.find(m => m.role === 'user' && m.content);
      if (firstUserMsg) {
        const contentToHash = typeof firstUserMsg.content === 'string' ? firstUserMsg.content : JSON.stringify(firstUserMsg.content);
        conversationId = crypto.createHash('md5').update(contentToHash.slice(0, 200)).digest('hex');
      } else { conversationId = crypto.randomUUID(); }

      let convBudget = conversationTokenUsage.get(conversationId);
      const now = Date.now();
      if (!convBudget || now - convBudget.createdAt > CONVERSATION_BUDGET_TTL) {
        convBudget = { usedTokens: 0, createdAt: now };
        conversationTokenUsage.set(conversationId, convBudget);
      }

      if (convBudget.usedTokens + inputTokens + max_tokens > CONVERSATION_TOKEN_BUDGET) {
        res.status(429).json({ error: { message: `Conversation token budget exceeded`, type: 'budget_exceeded', requestId } });
        return;
      }

      // ═══ STEP 6: CACHE CHECK ═══
      const cacheable = !stream && !tools && !tool_choice && (temperature === 0 || temperature === undefined);
      let cacheKey = null;
      if (cacheable) {
        cacheKey = getCacheKey(processedMessages, { temperature, max_tokens, top_p, model: requestedModel });
        const cached = get(cacheKey);
        if (cached) {
          cacheHit = true;
          logRequest(RequestsModel, userId, 'cache', 'cached', null, 'success', inputTokens, cached.usage?.completion_tokens || 0, Date.now() - profiler.start, null, taskType, 0, requestId);
          res.setHeader('X-Cache-Hit', 'true'); res.setHeader('X-Request-Id', requestId);
          res.json(sanitizeProviderResponse(cached));
          return;
        }
      }

      // ═══ STEP 7: ROUTING WITH PROVIDER MESH ═══
      let preferredModel;
      if (isAutoModel(requestedModel)) {
        preferredModel = getStickyModel(messages);
      } else if (requestedModel) {
        const enabled = await ModelsModel.findOne({ modelId: requestedModel, enabled: true, deletedAt: null }).lean();
        if (enabled) { preferredModel = enabled._id; }
        else {
          res.status(400).json({ error: { message: `Model '${requestedModel}' not found or disabled. Use 'auto' for auto-routing.`, type: 'invalid_request_error', code: 'model_not_found', requestId } });
          return;
        }
      } else { preferredModel = getStickyModel(messages); }

      const skipKeys = new Set();
      const lastError = null;
      const fallbackStartTime = Date.now();
      fallbackMetrics.totalRequests++;

      // ═══ ENHANCED EXECUTION LOOP ═══
      while (retryState.shouldContinue()) {
        // Global timeout check
        if (Date.now() - fallbackStartTime > FALLBACK_GLOBAL_TIMEOUT_MS) {
          res.status(504).json({ error: { message: 'Request timeout: all providers exhausted', type: 'timeout_error', requestId } });
          return;
        }

        let route;
        try {
          // ── Route via legacy router (proven & fast) ──
          route = await routeRequest(
            ModelsModel, ApiKeysModel, FallbackConfigModel,
            inputTokens + max_tokens, skipKeys.size > 0 ? skipKeys : undefined,
            preferredModel, taskType, isIdeMode, hasTools, userId, allowSharedKeysFallback
          );
          profiler.mark('routing');
          keyId = route.keyId;
        } catch (err) {
          // Route error (no providers available)
          const classified = classifyError(err, 'router');
          res.status(err.status || 429).json({
            error: { message: err.message, type: classified.category === 'rate_limit' ? 'rate_limit_error' : 'routing_error', requestId }
          });
          logRequest(RequestsModel, userId, 'unknown', 'unknown', null, 'error', inputTokens, 0, Date.now() - profiler.start, err.message, taskType, fallbackCount, requestId);
          return;
        }

        // ═══ POLICY ENGINE CHECK ═══
        const policyResult = policyEngine.evaluate({
          provider: route.platform, modelId: route.modelId, taskType, request: req.body,
        });
        if (!policyResult.allowed) {
          const skipId = `${route.platform}:${route.modelId}:${route.keyId}`;
          skipKeys.add(skipId);
          if (route.mesh) recordMeshResult(requestId, route.platform, String(route.keyId), route.modelId, false, 0, 'policy_denied', 'policy_denied');
          fallbackCount++;
          continue;
        }

        // ═══ QUOTA ENGINE CHECK ═══
        const quotaCheck = quotaEngine.checkQuota(route.platform, route.modelId, String(route.keyId), userId, inputTokens + max_tokens);
        if (!quotaCheck.allowed) {
          skipKeys.add(`${route.platform}:${route.modelId}:${route.keyId}`);
          if (route.mesh) recordMeshResult(requestId, route.platform, String(route.keyId), route.modelId, false, 0, 'quota_exceeded', 'quota_exceeded');
          fallbackCount++;
          continue;
        }

        // ═══ PROVIDER CALL ═══
        recordRequest(route.platform, route.modelId, route.keyId);
        const requestStart = Date.now();
        profiler.mark('provider');

        const safeMessages = sanitizeMessages(processedMessages);

        try {
          if (stream) {
            // ── STREAMING ──
            let totalOutputTokens = 0;
            let streamStarted = false;
            try {
              const gen = route.provider.streamChatCompletion(
                route.apiKey, safeMessages, route.modelId,
                { temperature, max_tokens, top_p, tools, tool_choice, timeout: requestTimeout }
              );

              let firstChunk = true;
              for await (const chunk of gen) {
                if (firstChunk) { profiler.mark('providerStreamStart'); firstChunk = false; }
                if (!streamStarted) {
                  res.setHeader('Content-Type', 'text/event-stream');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.setHeader('Connection', 'keep-alive');
                  res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
                  res.setHeader('X-Task-Type', taskType);
                  res.setHeader('X-Request-Id', requestId);
                  res.setHeader('X-Circuit-Breaker', cbV2.isAvailable(route.platform) ? 'closed' : 'open');
                  streamStarted = true;
                }
                const text = chunk.choices?.[0]?.delta?.content || '';
                totalOutputTokens += Math.ceil(text.length / 4);
                res.write('data: ' + JSON.stringify(sanitizeStreamChunk(chunk)) + '\n\n');
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
              const totalTokensUsed = inputTokens + totalOutputTokens;
              convBudget.usedTokens += totalTokensUsed;

              // Record success everywhere
              recordTokens(route.platform, route.modelId, route.keyId, totalTokensUsed);
              recordSuccess(route.modelDbId);
              cbV2.recordSuccess(route.platform);
              healthMonitor.recordSuccess(route.platform, latency, inputTokens, totalOutputTokens);
              perfMetrics.recordSuccess(route.platform, route.modelId, latency, inputTokens, totalOutputTokens);
              keyPoolManager.recordKeySuccess(route.platform, route.keyId, latency);
              quotaEngine.recordRequest(route.platform, route.modelId, String(route.keyId), userId, inputTokens, totalOutputTokens);
              setStickyModel(processedMessages, route.modelDbId);
              if (route.mesh) recordMeshResult(requestId, route.platform, String(route.keyId), route.modelId, true, latency);

              logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'success', inputTokens, totalOutputTokens, latency, null, taskType, fallbackCount, requestId);
              profiler.mark('mongo'); profiler.mark('serialize');
              return;

            } catch (streamErr) {
              if (streamStarted) {
                // Mid-stream error → classify and log
                const classified = classifyError(streamErr, route.platform);
                healthMonitor.recordFailure(route.platform, classified.rawMessage, Date.now() - requestStart);
                cbV2.recordFailure(route.platform);

                try { res.write('data: ' + JSON.stringify({ error: { message: `Provider error (${route.displayName}): stream interrupted`, type: 'stream_error' } }) + '\n\n'); } catch {}
                try { res.write('data: [DONE]\n\n'); res.end(); } catch {}
                logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', inputTokens, totalOutputTokens, Date.now() - requestStart, streamErr.message, taskType, fallbackCount, requestId);
                return;
              }
              throw streamErr;
            }

          } else {
            // ── NON-STREAMING ──
            const result = await route.provider.chatCompletion(
              route.apiKey, safeMessages, route.modelId,
              { temperature, max_tokens, top_p, tools, tool_choice, timeout: requestTimeout }
            );
            profiler.mark('providerEnd');

            // ═══ RESPONSE VALIDATION (NEW) ═══
            const validation = validateResponse(result, {
              expectToolCalls: hasTools,
              provider: route.platform,
            });

            if (!validation.valid) {
              // Response is invalid → classify and fallback
              const classified = classifyError(new Error(`Invalid response from ${route.platform}: ${validation.issues.join(', ')}`), route.platform);
              healthMonitor.recordFailure(route.platform, classified.rawMessage);
              cbV2.recordFailure(route.platform);
              skipKeys.add(`${route.platform}:${route.modelId}:${route.keyId}`);
              fallbackCount++;
              continue;
            }

            const latency = Date.now() - requestStart;
            const totalTokens = result.usage?.total_tokens || 0;
            const inputTokensResult = result.usage?.prompt_tokens || inputTokens;
            const outputTokensResult = result.usage?.completion_tokens || 0;

            convBudget.usedTokens += totalTokens;

            // Record success everywhere
            recordTokens(route.platform, route.modelId, route.keyId, totalTokens);
            recordSuccess(route.modelDbId);
            cbV2.recordSuccess(route.platform);
            healthMonitor.recordSuccess(route.platform, latency, inputTokensResult, outputTokensResult);
            perfMetrics.recordSuccess(route.platform, route.modelId, latency, inputTokensResult, outputTokensResult);
            keyPoolManager.recordKeySuccess(route.platform, route.keyId, latency);
            quotaEngine.recordRequest(route.platform, route.modelId, String(route.keyId), userId, inputTokensResult, outputTokensResult);
            setStickyModel(processedMessages, route.modelDbId);
            if (route.mesh) recordMeshResult(requestId, route.platform, String(route.keyId), route.modelId, true, latency);

            // Cache if applicable
            if (cacheable && cacheKey && fallbackCount === 0) set(cacheKey, result);

            res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
            res.setHeader('X-Task-Type', taskType);
            res.setHeader('X-Request-Id', requestId);
            res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
            res.setHeader('X-Circuit-Breaker', 'closed');

            logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'success', inputTokensResult, outputTokensResult, latency, null, taskType, fallbackCount, requestId);
            profiler.mark('mongo'); profiler.mark('serialize');
            res.json(sanitizeProviderResponse(validation.sanitizedResponse || result));
            return;
          }

        } catch (err) {
          const latency = Date.now() - requestStart;

          // ═══ ERROR CLASSIFICATION (NEW) ═══
          const classified = classifyError(err, route.platform);

          // Record failure in all systems
          healthMonitor.recordFailure(route.platform, classified.rawMessage, latency);
          cbV2.recordFailure(route.platform);
          perfMetrics.recordFailure(route.platform, route.modelId);
          keyPoolManager.recordKeyFailure(route.platform, route.keyId, classified.rawMessage);
          if (route.mesh) recordMeshResult(requestId, route.platform, String(route.keyId), route.modelId, false, latency, classified.rawMessage, classified.category);

          logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', inputTokens, 0, latency, classified.rawMessage, taskType, fallbackCount, requestId);

          // ═══ SMART RETRY DECISION (NEW) ═══
          const decision = retryState.recordAttempt(err, route.platform, route.keyId);

          if (decision.action === 'fail') {
            // Non-retryable or budget exhausted
            res.status(classified.httpCode >= 400 && classified.httpCode < 500 ? classified.httpCode : 502).json({
              error: {
                message: `Provider error (${route.displayName}): ${classified.rawMessage.slice(0, 200)}`,
                type: classified.category,
                requestId,
                _enhanced: true,
                _classification: classified.category,
              },
            });
            return;
          }

          if (decision.action === 'retry_same_provider') {
            // Network error → retry with backoff
            await wait(decision.delayMs);
            continue;
          }

          if (decision.action === 'fallback') {
            // Skip to next key/provider
            skipKeys.add(`${route.platform}:${route.modelId}:${route.keyId}`);
            fallbackCount++;
            fallbackMetrics.totalFallbacks++;
            if (decision.delayMs > 0) await wait(decision.delayMs);
            continue;
          }
        }
      }

      // All providers exhausted
      res.status(429).json({
        error: {
          message: `All models exhausted after ${fallbackCount} attempts. ${lastError ? 'Last: ' + lastError.message : ''}`,
          type: 'rate_limit_error',
          requestId,
          _enhanced: true,
          _retrySummary: retryState.getSummary(),
        },
      });

    } finally {
      // Always log final status
      const summary = retryState.getSummary();
      if (summary.totalAttempts > 0) {
        logger.debug({ component: 'EnhancedProxy', event: 'REQUEST_COMPLETE', requestId, ...summary });
      }
    }
  });

  return router;
}

module.exports = { createEnhancedProxyRouter, fallbackMetrics };
