/**
 * Point C — Vérification du CÂBLAGE HTTP RÉEL du proxy.
 *
 * Les tests de `providerPenaltyPolicy.test.js` reproduisent la politique de
 * décision et son effet sur des modules de santé instanciés à la main : ils ne
 * prouvent pas que les DEUX branches du proxy (streaming / non-streaming)
 * appliquent réellement cette politique. Ce harnais monte la vraie route
 * `/v1/chat/completions` sur un serveur HTTP réel, avec les modèles Mongo
 * simulés et les fournisseurs remplacés par des doubles déterministes, puis
 * inspecte les états RÉELS de :
 *   - `cbV2`        (core/services/circuitBreaker.js)
 *   - Circuit Breaker historique (inferenceLogger.circuitBreaker — celui que
 *     `router.js` consulte réellement)
 *   - `healthMonitor` (providerHealthMonitor)
 *   - `perfMetrics`   (performanceMetrics, clé = platform:modelId)
 *   - KeyPool         (keyPoolManager.getKeyStats / getAllStats)
 *
 * Scénarios exigés :
 *   1. INVALID_REQUEST          → aucune pénalité fournisseur
 *   2. Timeout fournisseur      → pénalité + fallback
 *   3. Déconnexion client       → aucune pénalité
 *   4. AUTH_ERROR               → cohérent entre les deux Circuit Breakers
 *   5. Erreur serveur (5xx)     → pénalité + fallback
 *   6. MODEL_UNAVAILABLE        → fallback SANS dégrader les autres modèles
 *   7. Streaming interrompu     → pénalité comptabilisée correctement
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const express = require('express');

// ── Le déchiffrement des clés n'est pas l'objet du test : on le neutralise
//    AVANT de charger le proxy, car `router.js` destructure `decrypt` à
//    l'import (`const { decrypt } = require('../lib/crypto.js')`). Un override
//    appliqué après le `require` du proxy n'aurait aucun effet et le vrai
//    `decrypt` lèverait « Encryption key not initialized » — exception avalée
//    par la boucle de sélection des clés, d'où un faux « tous les modèles sont
//    épuisés » (429).
const cryptoPath = require.resolve('../core/lib/crypto.js');
require(cryptoPath);
require.cache[cryptoPath].exports.decrypt = () => 'sk-test-key';

const { createEnhancedProxyRouter } = require('../core/routes/enhancedProxy.js');
const cbV2 = require('../core/services/circuitBreaker.js');
const { circuitBreaker: legacyBreaker } = require('../core/services/inferenceLogger.js');
const { monitor: healthMonitor } = require('../core/services/providerHealthMonitor.js');
const perfMetrics = require('../core/services/performanceMetrics.js');
const keyPoolManager = require('../core/services/keyPoolManager.js');
const { getProvider } = require('../core/providers/index.js');

let passed = 0;
let failed = 0;

const UNIFIED_KEY = 'freellm-wiring-unified-key';
const GROQ_A = 'llama-3.3-70b';
const GROQ_B = 'llama-3.2-3b';
const CEREBRAS_M = 'llama-3.1-8b';
const KEY_ID = { groq: 'k-groq', cerebras: 'k-cerebras' };

// ─── "Base de données" en mémoire ────────────────────────────
const state = {
  models: [],
  chain: [],
  keys: [
    { _id: 'k-groq', platform: 'groq', encryptedKey: 'enc', iv: 'iv', authTag: 'tag', enabled: true, status: 'active', deletedAt: null },
    { _id: 'k-cerebras', platform: 'cerebras', encryptedKey: 'enc', iv: 'iv', authTag: 'tag', enabled: true, status: 'active', deletedAt: null },
  ],
  requestLog: [],
  updateOneCalls: [],
};

function matches(doc, filter) {
  for (const [field, value] of Object.entries(filter || {})) {
    if (value && typeof value === 'object' && '$in' in value) {
      if (!value.$in.map(String).includes(String(doc[field]))) return false;
    } else if (value && typeof value === 'object' && '$ne' in value) {
      if (String(doc[field]) === String(value.$ne)) return false;
    } else if (value === null) {
      if (doc[field] !== null && doc[field] !== undefined) return false;
    } else if (String(doc[field]) !== String(value)) {
      return false;
    }
  }
  return true;
}

function makeQuery(promise) {
  const query = {
    sort: () => query,
    limit: () => query,
    select: () => query,
    lean: () => promise,
    then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
    catch: (onRejected) => promise.catch(onRejected),
  };
  return query;
}

const ModelsModel = {
  find: (filter) => makeQuery(Promise.resolve(state.models.filter(d => matches(d, filter)))),
  findOne: (filter) => makeQuery(Promise.resolve(state.models.find(d => matches(d, filter)) || null)),
};

const ApiKeysModel = {
  find: (filter) => makeQuery(Promise.resolve(state.keys.filter(d => matches(d, filter)))),
  updateOne: async (filter, update) => {
    state.updateOneCalls.push({ filter, update });
    return { modifiedCount: 1 };
  },
};

const FallbackConfigModel = {
  find: (filter) => makeQuery(Promise.resolve(state.chain.filter(d => matches(d, filter)))),
};

const RequestsModel = {
  create: async (doc) => { state.requestLog.push(doc); return doc; },
};

const UserModel = {
  findOne: () => makeQuery(Promise.resolve({ _id: 'admin-user', role: 'admin' })),
};

// ─── Chaîne de modèles configurable par scénario ─────────────
function setChain(spec) {
  state.models = spec.map(m => ({
    _id: `m-${m.platform}-${m.modelId}`,
    platform: m.platform,
    modelId: m.modelId,
    displayName: `${m.platform}/${m.modelId}`,
    enabled: true,
    deletedAt: null,
    speedRank: m.speedRank ?? 1,
    rpmLimit: null,
    rpdLimit: null,
    tpmLimit: null,
    tpdLimit: null,
  }));
  state.chain = spec.map((m, i) => ({
    _id: `fc-${i}`,
    modelDbId: `m-${m.platform}-${m.modelId}`,
    priority: m.priority ?? i + 1,
    enabled: true,
    deletedAt: null,
  }));
}

// ─── Doubles de fournisseurs ─────────────────────────────────
const calls = { groq: [], cerebras: [] };
const handlers = {};

function abortError() {
  const err = new Error('This operation was aborted');
  err.name = 'AbortError';
  err.code = 20;
  return err;
}

function okResponse(platform, modelId) {
  return {
    id: 'chatcmpl-wiring',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{ index: 0, message: { role: 'assistant', content: `réponse de ${platform}/${modelId}` }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    _routed_via: { platform, model: modelId },
  };
}

async function* okStream(platform, modelId, options) {
  yield { id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: `réponse de ${platform}` } }] };
  await wait(5);
  if (options?.signal?.aborted) throw abortError();
  yield { id: 'c2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: `/${modelId}` }, finish_reason: 'stop' }] };
}

function installProvider(platform) {
  const provider = getProvider(platform);
  provider.chatCompletion = async (apiKey, messages, modelId, options) => {
    calls[platform].push({ modelId, stream: false });
    return handlers[platform].chat(modelId, options);
  };
  provider.streamChatCompletion = (apiKey, messages, modelId, options) => {
    calls[platform].push({ modelId, stream: true });
    return handlers[platform].stream(modelId, options);
  };
}

handlers.groq = {
  chat: async (modelId) => okResponse('groq', modelId),
  stream: (modelId, options) => okStream('groq', modelId, options),
};
handlers.cerebras = {
  chat: async (modelId) => okResponse('cerebras', modelId),
  stream: (modelId, options) => okStream('cerebras', modelId, options),
};
installProvider('groq');
installProvider('cerebras');

// ─── App HTTP réelle ──────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.getModel = (name) => (name === 'User' ? UserModel : null); next(); });
app.use('/v1', createEnhancedProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, UNIFIED_KEY));

let server;
let port;

function request(body, options = {}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${UNIFIED_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      res.on('error', () => resolve({ status: res.statusCode, headers: res.headers, body: data, aborted: true }));
    });
    // Déconnexion client simulée : on coupe la socket en plein appel.
    if (options.abortAfterMs) setTimeout(() => req.destroy(), options.abortAfterMs);
    req.on('error', (err) => resolve({ aborted: true, error: err.message }));
    req.end(payload);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Lecture des états réels des systèmes de santé ───────────
function health(platform, modelId) {
  const keyStats = keyPoolManager.getKeyStats(platform, KEY_ID[platform]) || {};
  return {
    cbV2Failures: cbV2.manager.getBreaker(platform).failureCount,
    cbV2Available: cbV2.isAvailable(platform),
    legacyFailures: legacyBreaker.getState(platform).failures,
    legacyAvailable: legacyBreaker.isAvailable(platform),
    healthTotal: healthMonitor.getHealth(platform).totalRequests,
    healthFailures: healthMonitor.getHealth(platform).failureCount,
    perfTotal: perfMetrics.getMetrics(platform, modelId).totalRequests,
    perfFailures: perfMetrics.getMetrics(platform, modelId).failureCount,
    keyFailures: keyStats.failureCount || 0,
    keyCooldown: keyStats.cooldownUntil || null,
    keyStatus: keyStats.status || 'unknown',
  };
}

function resetHealth() {
  cbV2.manager.resetAll();
  legacyBreaker.state.clear();
  healthMonitor.health.clear();
  for (const platform of ['groq', 'cerebras']) {
    const stats = keyPoolManager.getKeyStats(platform, KEY_ID[platform]);
    if (stats) {
      Object.assign(stats, {
        totalRequests: 0, successCount: 0, failureCount: 0,
        cooldownUntil: null, status: 'active', disabledAt: null, recentErrors: [],
      });
    }
  }
  for (const modelId of [GROQ_A, GROQ_B, CEREBRAS_M]) {
    for (const platform of ['groq', 'cerebras']) {
      const m = perfMetrics.getMetrics(platform, modelId);
      m.totalRequests = 0; m.successCount = 0; m.failureCount = 0;
      m.totalLatencyMs = 0; m.latencyHistory = [];
    }
  }
  calls.groq.length = 0;
  calls.cerebras.length = 0;
  state.requestLog.length = 0;
  state.updateOneCalls.length = 0;
}

const DEFAULT_CHAIN = [
  { platform: 'groq', modelId: GROQ_A, priority: 1, speedRank: 1 },
  { platform: 'cerebras', modelId: CEREBRAS_M, priority: 2, speedRank: 2 },
];

async function scenario(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${label}: ${err.message}`);
  }
}

function chatBody(model, extra = {}) {
  return { model, messages: [{ role: 'user', content: 'Bonjour, explique-moi le routage.' }], ...extra };
}

// ══════════════════════════════════════════════════════════════
(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { port = server.address().port; resolve(); }); });
  console.log('\n🌐 Proxy Wiring (HTTP réel) — /v1/chat/completions\n');

  // ── 1. INVALID_REQUEST : aucune pénalité fournisseur ────────
  await scenario('1. INVALID_REQUEST → 400, aucune pénalité (4 systèmes intacts)', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.chat = async () => { throw new Error('Groq API error 400: invalid request payload'); };

    const res = await request(chatBody(GROQ_A));

    assert.strictEqual(res.status, 400, `statut attendu 400, reçu ${res.status}`);
    assert.ok(res.body.includes('invalid_request'), 'la réponse doit exposer la classification');
    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 0, `cbV2 groq touché (${g.cbV2Failures})`);
    assert.strictEqual(g.legacyFailures, 0, `Circuit Breaker historique touché (${g.legacyFailures})`);
    assert.strictEqual(g.healthTotal, 0, `healthMonitor groq touché (${g.healthTotal})`);
    assert.strictEqual(g.perfTotal, 0, `perfMetrics touché (${g.perfTotal})`);
    assert.strictEqual(g.keyFailures, 0, `KeyPool touché (${g.keyFailures})`);
    assert.strictEqual(calls.cerebras.length, 0, 'aucun fallback ne doit être déclenché');
    assert.ok(state.requestLog.some(r => r.status === 'error'), 'la requête doit rester journalisée');
  });

  // ── 2. Timeout fournisseur → pénalité + fallback ────────────
  await scenario('2. Timeout fournisseur → pénalité + fallback vers un autre fournisseur', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.chat = async () => { throw abortError(); };

    const res = await request(chatBody(GROQ_A));

    assert.strictEqual(res.status, 200, `statut attendu 200 (fallback), reçu ${res.status}`);
    assert.strictEqual(res.headers['x-routed-via'], `cerebras/${CEREBRAS_M}`, 'le fallback doit servir via cerebras');
    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 1, `cbV2 groq attendu à 1, reçu ${g.cbV2Failures}`);
    assert.strictEqual(g.healthFailures, 1, `health groq attendu à 1, reçu ${g.healthFailures}`);
    assert.strictEqual(g.perfFailures, 1, `perfMetrics attendu à 1, reçu ${g.perfFailures}`);
    // Un timeout (annulation du fetch par le timer local) est refusé par le
    // filtre « aborted » du KeyPool : ni compteur de clé, ni CB historique.
    assert.strictEqual(g.keyFailures, 0, `KeyPool : un timeout ne doit pas pénaliser la clé (${g.keyFailures})`);
    assert.strictEqual(g.keyCooldown, null, 'aucun cooldown de clé sur timeout');
    assert.strictEqual(g.legacyFailures, 0, `CB historique non touché par un timeout (${g.legacyFailures})`);
  });

  // ── 3. Déconnexion client → aucune pénalité ─────────────────
  await scenario('3. Déconnexion client → aucune pénalité fournisseur', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.chat = (modelId, options) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(okResponse('groq', modelId)), 400);
      const onAbort = () => { clearTimeout(timer); reject(abortError()); };
      if (options?.signal) {
        if (options.signal.aborted) return onAbort();
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    });

    const res = await request(chatBody(GROQ_A), { abortAfterMs: 60 });
    assert.ok(res.aborted, 'la requête cliente doit bien avoir été interrompue');
    await wait(200); // laisser le serveur traiter la rupture

    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 0, `cbV2 touché (${g.cbV2Failures})`);
    assert.strictEqual(g.legacyFailures, 0, `CB historique touché (${g.legacyFailures})`);
    assert.strictEqual(g.healthTotal, 0, `healthMonitor touché (${g.healthTotal})`);
    assert.strictEqual(g.perfTotal, 0, `perfMetrics touché (${g.perfTotal})`);
    assert.strictEqual(g.keyFailures, 0, `KeyPool touché (${g.keyFailures})`);
    assert.ok(
      state.requestLog.some(r => r.status === 'client_aborted'),
      'la requête doit être journalisée en client_aborted'
    );
  });

  // ── 4. AUTH_ERROR cohérent entre les deux Circuit Breakers ──
  await scenario('4. AUTH_ERROR → les deux Circuit Breakers avancent, clé invalidée 24 h', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.chat = async () => { throw new Error('Groq API error 401: invalid api key'); };

    const res = await request(chatBody(GROQ_A));

    assert.strictEqual(res.status, 401, `statut attendu 401, reçu ${res.status}`);
    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 1, `cbV2 groq attendu à 1, reçu ${g.cbV2Failures}`);
    assert.strictEqual(g.legacyFailures, 1, `CB historique attendu à 1, reçu ${g.legacyFailures}`);
    assert.strictEqual(g.keyStatus, 'invalid', 'la clé doit être marquée invalide');
    assert.ok(g.keyCooldown - Date.now() > 23 * 3600 * 1000, 'la clé doit être mise en cooldown ~24 h');
    const persisted = state.updateOneCalls.find(c => c.filter && c.filter._id === 'k-groq');
    assert.ok(persisted, 'la clé morte doit être persistée en base');
    assert.deepStrictEqual(persisted.update, { $set: { status: 'invalid', enabled: false } });
  });

  // ── 5. Erreur serveur (5xx) → pénalité + fallback ───────────
  await scenario('5. Erreur serveur 500 → pénalité (4 systèmes) + fallback', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.chat = async () => { throw new Error('Groq API error 500: internal server error'); };

    const res = await request(chatBody(GROQ_A));

    assert.strictEqual(res.status, 200, `statut attendu 200 (fallback), reçu ${res.status}`);
    assert.strictEqual(res.headers['x-routed-via'], `cerebras/${CEREBRAS_M}`, 'le fallback doit servir via cerebras');
    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 1, `cbV2 groq attendu à 1, reçu ${g.cbV2Failures}`);
    assert.strictEqual(g.legacyFailures, 1, `CB historique attendu à 1, reçu ${g.legacyFailures}`);
    assert.strictEqual(g.healthFailures, 1, `health groq attendu à 1, reçu ${g.healthFailures}`);
    assert.strictEqual(g.perfFailures, 1, `perfMetrics attendu à 1, reçu ${g.perfFailures}`);
    assert.strictEqual(g.keyFailures, 1, `KeyPool : une erreur 5xx refroidit la clé (${g.keyFailures})`);
    assert.ok(g.keyCooldown > Date.now(), 'un cooldown de clé doit être posé');
    assert.strictEqual(g.keyStatus, 'active', 'la clé n\'est PAS invalidée par une 5xx');
  });

  // ── 6. MODEL_UNAVAILABLE → fallback sans dégrader les autres modèles ──
  await scenario('6. MODEL_UNAVAILABLE → fallback, fournisseur et autres modèles intacts', async () => {
    resetHealth();
    // groq expose DEUX modèles : seul le modèle A est « mort ».
    setChain([
      { platform: 'groq', modelId: GROQ_A, priority: 1, speedRank: 1 },
      { platform: 'groq', modelId: GROQ_B, priority: 2, speedRank: 2 },
      { platform: 'cerebras', modelId: CEREBRAS_M, priority: 3, speedRank: 3 },
    ]);
    handlers.groq.chat = async (modelId) => {
      if (modelId === GROQ_A) throw new Error(`Groq API error 404: model ${GROQ_A} is not found`);
      return okResponse('groq', modelId);
    };

    // 6 requêtes demandant le modèle mort : sans la correction A, 5 échecs
    // auraient ouvert les DEUX Circuit Breakers du fournisseur.
    for (let i = 0; i < 6; i++) {
      const res = await request(chatBody(GROQ_A));
      assert.strictEqual(res.status, 200, `requête ${i + 1} : statut attendu 200, reçu ${res.status}`);
    }

    const gA = health('groq', GROQ_A);
    assert.strictEqual(gA.cbV2Failures, 0, `cbV2 groq touché (${gA.cbV2Failures})`);
    assert.strictEqual(gA.legacyFailures, 0, `CB historique touché (${gA.legacyFailures})`);
    assert.strictEqual(gA.healthTotal, 0, `healthMonitor groq touché (${gA.healthTotal})`);
    assert.strictEqual(gA.perfTotal, 0, `perfMetrics touché (${gA.perfTotal})`);
    assert.strictEqual(gA.keyFailures, 0, `KeyPool touché (${gA.keyFailures})`);
    assert.strictEqual(gA.keyCooldown, null, 'aucun cooldown de clé pour un modèle indisponible');
    assert.strictEqual(cbV2.isAvailable('groq'), true, 'groq doit rester disponible');
    assert.strictEqual(legacyBreaker.isAvailable('groq'), true, 'groq doit rester routable (CB historique)');

    // L'AUTRE modèle du même fournisseur reste servi par groq.
    const resB = await request(chatBody(GROQ_B));
    assert.strictEqual(resB.status, 200, `modèle B : statut attendu 200, reçu ${resB.status}`);
    assert.strictEqual(resB.headers['x-routed-via'], `groq/${GROQ_B}`, 'le modèle B de groq reste routable');
  });

  // ── 7. Streaming interrompu par une erreur fournisseur ──────
  await scenario('7. Streaming interrompu par une erreur fournisseur → pénalité comptée', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.stream = async function* () {
      yield { id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'Bon' } }] };
      yield { id: 'c2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'jour' } }] };
      throw new Error('Groq API error 503: upstream failure');
    };

    const res = await request(chatBody(GROQ_A, { stream: true }));

    assert.strictEqual(res.status, 200, `statut attendu 200 (flux déjà commencé), reçu ${res.status}`);
    assert.ok(res.body.includes('stream_error'), 'le client doit être informé de l\'interruption');
    assert.ok(res.body.includes('Bon'), 'les chunks déjà produits doivent être transmis');
    assert.ok(res.body.includes('[DONE]'), 'le flux doit être clos proprement');
    assert.strictEqual(calls.cerebras.length, 0, 'une erreur en cours de flux ne relance pas un fallback');

    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 1, `cbV2 groq attendu à 1, reçu ${g.cbV2Failures}`);
    assert.strictEqual(g.legacyFailures, 1, `CB historique attendu à 1, reçu ${g.legacyFailures}`);
    assert.strictEqual(g.healthFailures, 1, `health groq attendu à 1, reçu ${g.healthFailures}`);
    assert.strictEqual(g.perfFailures, 1, `perfMetrics attendu à 1, reçu ${g.perfFailures}`);
    assert.strictEqual(g.keyFailures, 1, `KeyPool attendu à 1, reçu ${g.keyFailures}`);
    assert.ok(state.requestLog.some(r => r.status === 'error'), 'l\'échec doit être journalisé');
  });

  // ── 8. Streaming nominal : succès comptabilisé côté fournisseur ──
  await scenario('8. Streaming nominal → succès enregistré dans les 4 systèmes', async () => {
    resetHealth();
    setChain(DEFAULT_CHAIN);
    handlers.groq.stream = (modelId, options) => okStream('groq', modelId, options);

    const res = await request(chatBody(GROQ_A, { stream: true }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['x-routed-via'], `groq/${GROQ_A}`);
    const g = health('groq', GROQ_A);
    assert.strictEqual(g.cbV2Failures, 0);
    assert.strictEqual(g.healthTotal, 1, `health groq : 1 requête attendue, reçu ${g.healthTotal}`);
    assert.strictEqual(g.healthFailures, 0);
    assert.strictEqual(g.perfTotal, 1, `perfMetrics : 1 requête attendue, reçu ${g.perfTotal}`);
    assert.strictEqual(g.perfFailures, 0);
    assert.strictEqual(g.keyFailures, 0);
    assert.ok(state.requestLog.some(r => r.status === 'success'), 'le succès doit être journalisé');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
})();
