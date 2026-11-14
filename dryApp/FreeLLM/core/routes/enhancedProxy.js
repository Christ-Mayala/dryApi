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
const { validateResponse, sanitizeResponse, chunkHasMeaningfulContent } = require('../services/responseValidator.js');
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
// Budget global de la chaîne de fallback. 45 s laisse la place à plusieurs
// fournisseurs tout en bornant l'attente de l'utilisateur — la consigne est
// qu'un appel légitime lent (jusqu'à ~20 s) doit aboutir, sans que l'échec
// définitif dure une minute.
//
// IMPORTANT — trois durées distinctes, à ne pas confondre :
//   • Budget de fallback (45 s) : borne la RECHERCHE d'un fournisseur disponible.
//     Il est vérifié ENTRE deux tentatives ; il n'interrompt jamais une
//     génération déjà commencée. Une génération légitime de 70 s lancée tôt dans
//     la chaîne doit aboutir.
//   • Timeout fournisseur (15-30 s, propre à chaque provider) : borne l'appel
//     HTTP (obtention des en-têtes). Conservé tel quel, il n'est pas modifié.
//   • Durée de génération : temps total de production du modèle, non borné par
//     le proxy une fois le streaming démarré.
const FALLBACK_GLOBAL_TIMEOUT_MS = 45_000;
// Budget minimal pour qu'une tentative ait une chance réelle d'aboutir. En
// dessous, on ne la démarre pas : une tentative lancée à 44 s avec un
// fournisseur muet courait jusqu'à son propre timeout (15-30 s) et faisait
// largement dépasser le budget global.
const MIN_ATTEMPT_BUDGET_MS = 5_000;
const conversationTokenUsage = new Map();
const CONVERSATION_BUDGET_TTL = 86_400_000;

/**
 * Indique si une nouvelle tentative peut démarrer dans le budget global restant.
 *
 * @param {number} elapsedMs      - Temps déjà consommé par la chaîne (ms)
 * @param {number} [totalBudgetMs] - Budget global (ms)
 * @param {number} [minAttemptMs]  - Délai minimal exigé pour démarrer (ms)
 * @returns {boolean}
 */
function hasBudgetForAttempt(
  elapsedMs,
  totalBudgetMs = FALLBACK_GLOBAL_TIMEOUT_MS,
  minAttemptMs = MIN_ATTEMPT_BUDGET_MS
) {
  return totalBudgetMs - elapsedMs >= minAttemptMs;
}

/**
 * Applique la pénalité fournisseur d'un échec, EN UN SEUL ENDROIT (D3).
 *
 * `classified.blacklistProvider` est la source unique de vérité produite par
 * `errorClassifier` : une erreur imputable au client (INVALID_REQUEST,
 * CONTENT_POLICY) n'applique rien, une erreur imputable au fournisseur (timeout,
 * 5xx, réseau, auth, flux coupé, modèle mort…) applique le MÊME jeu de
 * pénalités partout dans le proxy.
 *
 * Les quatre systèmes sont volontairement groupés :
 *   • `cbV2`              — Circuit Breaker V2 (visibilité /health) ;
 *   • `keyPoolManager`    — alimente le Circuit Breaker HISTORIQUE, celui que
 *                           `router.js` consulte réellement pour écarter une
 *                           plateforme : sans lui, une pénalité n'a aucun effet
 *                           sur le routage ;
 *   • `healthMonitor`     — santé par plateforme (`/health/enhanced`) ;
 *   • `perfMetrics`       — taux de succès par (plateforme, modèle), consommé
 *                           par le score du routeur.
 *
 * Auparavant, seuls les deux catchs généraux appliquaient les quatre ; les
 * branches « flux vide », « flux interrompu en cours de génération » et
 * « réponse invalide » n'en appliquaient qu'une partie, si bien qu'un
 * fournisseur qui cassait systématiquement ses flux n'était jamais écarté du
 * routage. Regrouper la règle garantit que les deux branches du proxy se
 * comportent identiquement.
 *
 * @param {object} classified - Résultat de `classifyError`
 * @param {object} route      - Route courante (platform, modelId, keyId)
 * @param {number} latencyMs  - Latence observée de la tentative
 * @returns {boolean} vrai si une pénalité a été appliquée
 */
function applyProviderPenalty(classified, route, latencyMs = 0) {
  if (!classified || !classified.blacklistProvider) return false;
  healthMonitor.recordFailure(route.platform, classified.rawMessage, latencyMs);
  cbV2.recordFailure(route.platform);
  perfMetrics.recordFailure(route.platform, route.modelId);
  keyPoolManager.recordKeyFailure(route.platform, route.keyId, classified.rawMessage);
  return true;
}

// ─── PII Sanitization (preserved from original) ──────────────
function sanitizeMessageContent(content) {
  if (typeof content !== 'string') return content;
  let s = content;
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

    // ─── P1 : annulation propre de la requête cliente ─────────────
    // Un AbortController unique par requête propage la déconnexion du client
    // jusqu'aux appels fournisseurs : le fetch en cours est annulé et les
    // ressources (connexion, flux, timers) sont libérées immédiatement, sans
    // pénaliser la santé du provider ni lancer un fallback inutile.
    //
    // IMPORTANT : on écoute 'close' sur `res` UNIQUEMENT — jamais sur `req`.
    // Depuis Node 16, `IncomingMessage` émet 'close' dès que la requête est
    // achevée, c'est-à-dire dès que le corps est entièrement lu (quelques
    // millisecondes après le début du handler). L'écouter reviendrait à
    // annuler l'appel fournisseur avant même qu'il ne parte. `ServerResponse`
    // émet 'close' à la fin de la réponse OU à la rupture prématurée de la
    // connexion : `writableEnded === false` identifie ce second cas.
    const clientAbort = new AbortController();
    let clientDisconnected = false;
    const onClientClose = () => {
      if (res.writableEnded) return; // réponse terminée normalement
      clientDisconnected = true;
      clientAbort.abort();
    };
    res.on('close', onClientClose);

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
          // NOVA : l'assistant IA est embarqué dans l'application. Un utilisateur
          // authentifié par son JWT doit pouvoir utiliser les clés partagées de
          // l'instance (configurées par l'administrateur), exactement comme le
          // fait la clé unifiée. Ses propres clés restent prioritaires.
          allowSharedKeysFallback = true;
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
      // Couples provider/modèle identifiés comme indisponibles pendant cette
      // requête : un modèle absent chez un fournisseur l'est pour TOUTES ses
      // clés, on évite donc d'y revenir (fallback vers le fournisseur suivant).
      const unavailableModelRoutes = new Set();
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

        // Modèle déjà constaté indisponible chez ce fournisseur : inutile de
        // retenter (même erreur garantie), on passe directement au suivant.
        if (unavailableModelRoutes.has(`${route.platform}:${route.modelId}`)) {
          skipKeys.add(`${route.platform}:${route.modelId}:${route.keyId}`);
          fallbackCount++;
          continue;
        }

        // Ne pas démarrer une tentative qui n'a plus le temps d'aboutir : sinon
        // une tentative lancée en fin de budget court jusqu'au timeout propre au
        // fournisseur (15-30 s) et dépasse largement le budget global.
        if (!hasBudgetForAttempt(Date.now() - fallbackStartTime)) {
          res.status(504).json({ error: { message: 'Request timeout: all providers exhausted', type: 'timeout_error', requestId } });
          return;
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
            let meaningfulContent = false;
            try {
              const gen = route.provider.streamChatCompletion(
                route.apiKey, safeMessages, route.modelId,
                { temperature, max_tokens, top_p, tools, tool_choice, timeout: requestTimeout, signal: clientAbort.signal }
              );

              let firstChunk = true;
              for await (const chunk of gen) {
                // Déconnexion client : on arrête la lecture du flux au plus tôt.
                if (clientDisconnected) break;
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
                // P3 : un chunk n'est « du contenu » que s'il transporte du texte
                // réel (content, reasoning_content) ou des tool_calls.
                if (chunkHasMeaningfulContent(chunk)) meaningfulContent = true;
                // P3 : compter content ET reasoning_content — les modèles de
                // raisonnement émettent d'abord du reasoning_content.
                const delta = chunk?.choices?.[0]?.delta || {};
                const text = delta.content || delta.reasoning_content || '';
                totalOutputTokens += Math.ceil(text.length / 4);
                res.write('data: ' + JSON.stringify(sanitizeStreamChunk(chunk)) + '\n\n');
              }
              profiler.mark('providerStreamEnd');
              profiler.mark('providerEnd');

              // Client parti pendant le flux : plus rien à écrire, et aucune
              // pénalité pour le fournisseur (la génération était légitime).
              if (clientDisconnected) {
                logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'client_aborted', inputTokens, totalOutputTokens, Date.now() - requestStart, 'client disconnected', taskType, fallbackCount, requestId);
                return;
              }

              // P3 : un flux qui se termine sans contenu n'est PAS un succès.
              // Si les en-têtes SSE ne sont pas encore partis, on peut basculer
              // proprement vers un autre fournisseur ; sinon on signale l'erreur.
              if (!meaningfulContent) {
                if (!streamStarted) {
                  throw new Error(`Empty stream from ${route.platform}: no content received`);
                }
                const emptyMsg = `Empty stream from ${route.platform}: [DONE] without content`;
                // Un flux clos sans contenu est imputable au fournisseur : même
                // jeu de pénalités que partout ailleurs (voir applyProviderPenalty).
                applyProviderPenalty(classifyError(emptyMsg, route.platform), route, Date.now() - requestStart);
                try { res.write('data: ' + JSON.stringify({ error: { message: `Provider error (${route.displayName}): empty stream`, type: 'stream_error' } }) + '\n\n'); } catch {}
                try { res.write('data: [DONE]\n\n'); res.end(); } catch {}
                logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'error', inputTokens, totalOutputTokens, Date.now() - requestStart, emptyMsg, taskType, fallbackCount, requestId);
                return;
              }

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
              // Déconnexion client réelle : on n'écrit rien et on ne pénalise pas
              // le fournisseur — la génération n'est pas en cause.
              //
              // Seul `clientDisconnected` est discriminant : un timeout fournisseur
              // se présente comme la même `AbortError` (annulation du fetch par le
              // timer local de fetchWithTimeout), il ne doit donc PAS être confondu
              // avec une déconnexion cliente, sinon le fournisseur fautif n'est ni
              // pénalisé ni remplacé par un fallback.
              if (clientDisconnected) {
                logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'client_aborted', inputTokens, totalOutputTokens, Date.now() - requestStart, streamErr.message, taskType, fallbackCount, requestId);
                return;
              }
              if (streamStarted) {
                // Mid-stream error → classify and penalise.
                const classified = classifyError(streamErr, route.platform);
                // D3 : `blacklistProvider` (classifieur) décide seul ; le jeu de
                // pénalités est identique à celui de la branche non-streaming.
                applyProviderPenalty(classified, route, Date.now() - requestStart);

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
              { temperature, max_tokens, top_p, tools, tool_choice, timeout: requestTimeout, signal: clientAbort.signal }
            );
            profiler.mark('providerEnd');

            // ═══ RESPONSE VALIDATION (NEW) ═══
            const validation = validateResponse(result, {
              expectToolCalls: hasTools,
              provider: route.platform,
            });

            if (!validation.valid) {
              // Response is invalid → classify, penalise the provider and fallback.
              const classified = classifyError(new Error(`Invalid response from ${route.platform}: ${validation.issues.join(', ')}`), route.platform);
              applyProviderPenalty(classified, route, Date.now() - requestStart);
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
          // Déconnexion client réelle : rien à écrire, aucune pénalité pour le
          // fournisseur, aucun fallback inutile. Un timeout fournisseur, en
          // revanche, est un vrai échec provider (voir catch streaming ci-dessus).
          if (clientDisconnected) {
            logRequest(RequestsModel, userId, route.platform, route.modelId, route.keyId, 'client_aborted', inputTokens, 0, latency, err.message, taskType, fallbackCount, requestId);
            return;
          }

          // ═══ ERROR CLASSIFICATION (NEW) ═══
          const classified = classifyError(err, route.platform);

          // Record failure in all systems.
          //
          // D3 : `blacklistProvider` (classifieur) est la source unique de vérité.
          // Une erreur imputable au client — INVALID_REQUEST, CONTENT_POLICY —
          // ne doit ni faire avancer le Circuit Breaker, ni dégrader la santé ou
          // le score du fournisseur, ni refroidir/comptabiliser la clé : sinon
          // quelques requêtes malformées suffisent à exclure temporairement un
          // fournisseur sain. L'erreur reste journalisée plus bas.
          applyProviderPenalty(classified, route, latency);
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
            // Passage à un autre fournisseur/clé : aucun backoff. La limite
            // rencontrée (429, quota, clé invalide…) est propre à la ressource
            // qu'on quitte ; attendre n'apportait rien au suivant et ajoutait
            // jusqu'à 10 s par étape, soit 20-30 s sur une chaîne courte.
            skipKeys.add(`${route.platform}:${route.modelId}:${route.keyId}`);
            // Modèle indisponible (HTTP 400/404/422 « model unavailable ») : ce
            // n'est pas une erreur de requête, on écarte le couple provider/modèle
            // pour ne pas retenter inutilement le même fournisseur.
            if (classified.category === 'model_unavailable') {
              unavailableModelRoutes.add(`${route.platform}:${route.modelId}`);
            }
            fallbackCount++;
            fallbackMetrics.totalFallbacks++;
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
      // Libère le listener de déconnexion (évite toute fuite de ressources).
      res.off('close', onClientClose);

      // Always log final status
      const summary = retryState.getSummary();
      if (summary.totalAttempts > 0) {
        logger.debug({ component: 'EnhancedProxy', event: 'REQUEST_COMPLETE', requestId, ...summary });
      }
    }
  });

  return router;
}

module.exports = { createEnhancedProxyRouter, fallbackMetrics, hasBudgetForAttempt };
