/**
 * Tests — Politique de pénalité fournisseur (correction D3).
 *
 * Objectif : empêcher le Circuit Breaker et le système de santé des fournisseurs
 * de pénaliser un fournisseur pour une erreur qui ne lui est pas imputable.
 *
 *   1. INVALID_REQUEST n'incrémente pas le compteur d'échecs du fournisseur ;
 *   2. une erreur client répétée ne peut pas ouvrir le Circuit Breaker ;
 *   3. un vrai timeout fournisseur incrémente le compteur ;
 *   4. une erreur serveur fournisseur incrémente le compteur ;
 *   5. une déconnexion client ne pénalise pas le fournisseur ;
 *   6. une erreur d'authentification suit la politique explicitement retenue ;
 *   7. les mécanismes de fallback restent fonctionnels ;
 *   8. un modèle indisponible n'ouvre pas le circuit GLOBAL du fournisseur
 *      (les autres modèles restent routables).
 *
 * La règle vient du classifieur : `blacklistProvider` est la source unique de
 * vérité (aucune règle dupliquée). Son application reprend celle de
 * `enhancedProxy.js` — catch streaming et catch général :
 *   if (classified.blacklistProvider) { healthMonitor, cbV2, perfMetrics, keyPool }
 *
 * NODE_ENV=test + secrets factices : `errorClassifier`/`circuitBreaker` passent
 * par `inferenceLogger`, qui importe la config applicative (config/database.js)
 * exigeant JWT_SECRET / SESSION_SECRET même hors production.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-0123456789abcdefghij';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-0123456789abc';
process.env.PORT = process.env.PORT || '5000';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '60000';
process.env.HEALTH_MONITOR_INTERVAL_MS = process.env.HEALTH_MONITOR_INTERVAL_MS || '0';

const assert = require('assert');
const { classifyError, ErrorCategory, CLASSIFICATION_RULES } = require('../core/services/errorClassifier');
const { CircuitBreakerManager, CIRCUIT_STATES } = require('../core/services/circuitBreaker');
const { ProviderHealthMonitor } = require('../core/services/providerHealthMonitor');
const { RetryState } = require('../core/services/smartRetry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ─── Miroir du proxy ─────────────────────────────────────────────
//
// Reproduit la décision de enhancedProxy.js sans passer par HTTP : les systèmes
// de santé sont les vrais modules (CircuitBreakerManager, ProviderHealthMonitor),
// seules les métriques et le KeyPool sont espionnés pour rester lisibles.

function makeSystems() {
  return {
    health: new ProviderHealthMonitor(),
    cb: new CircuitBreakerManager(),
    perf: {
      failures: [],
      recordFailure(platform, modelId) { this.failures.push(`${platform}/${modelId}`); },
    },
    keyPool: {
      failures: [],
      recordKeyFailure(platform, keyId) { this.failures.push(`${platform}/${keyId}`); },
    },
  };
}

/**
 * Applique l'issue d'un échec fournisseur exactement comme le proxy.
 * @returns {boolean} vrai si une pénalité fournisseur a été appliquée.
 */
function applyProviderFailure(classified, systems, {
  platform,
  modelId = 'model-under-test',
  keyId = 'key-1',
  latencyMs = 0,
} = {}) {
  if (!classified.blacklistProvider) return false;
  systems.health.recordFailure(platform, classified.rawMessage, latencyMs);
  systems.cb.recordFailure(platform);
  systems.perf.recordFailure(platform, modelId);
  systems.keyPool.recordKeyFailure(platform, keyId);
  return true;
}

/**
 * Miroir du catch du proxy : `clientDisconnected` sort AVANT toute
 * classification et toute pénalité (voir enhancedProxy.js, catch streaming et
 * catch général).
 */
function handleProviderError(error, { clientDisconnected, platform, systems }) {
  if (clientDisconnected) return 'client_aborted';
  const classified = classifyError(error, platform);
  applyProviderFailure(classified, systems, { platform });
  return classified.category;
}

function timeoutAbortError() {
  // Forme exacte de l'erreur émise par le timer local de fetchWithTimeout.
  const err = new Error('This operation was aborted');
  err.name = 'AbortError';
  err.code = 20;
  return err;
}

console.log('\n🛡️  Provider Penalty Policy (D3) Tests\n');

// ─── Règles de classification (source unique de vérité) ──────────
console.log('Règles de classification : qui est imputable au fournisseur ?');

test('INVALID_REQUEST n\'est pas imputable au fournisseur', () => {
  const c = classifyError(new Error('400 Bad Request: malformed JSON body'));
  assert.strictEqual(c.category, ErrorCategory.INVALID_REQUEST);
  assert.strictEqual(c.blacklistProvider, false, 'une requête malformée ne pénalise pas le fournisseur');
});

test('CONTENT_POLICY n\'est pas imputable au fournisseur', () => {
  const c = classifyError(new Error('content policy violation'));
  assert.strictEqual(c.category, ErrorCategory.CONTENT_POLICY);
  assert.strictEqual(c.blacklistProvider, false, 'le contenu vient du client');
});

test('TIMEOUT / SERVER_ERROR / NETWORK_ERROR / RATE_LIMIT sont imputables', () => {
  const cases = [
    [new Error('ETIMEDOUT'), ErrorCategory.TIMEOUT],
    [new Error('500 Internal Server Error'), ErrorCategory.SERVER_ERROR],
    [new Error('ECONNREFUSED'), ErrorCategory.NETWORK_ERROR],
    [new Error('429 Too Many Requests'), ErrorCategory.RATE_LIMIT],
  ];
  for (const [err, expected] of cases) {
    const c = classifyError(err);
    assert.strictEqual(c.category, expected, `catégorie attendue ${expected}`);
    assert.strictEqual(c.blacklistProvider, true, `${expected} doit pénaliser le fournisseur`);
  }
});

test('MODEL_UNAVAILABLE n\'est pas imputable au fournisseur (A : disponible au niveau modèle)', () => {
  const c = classifyError(new Error('404 model not found'));
  assert.strictEqual(c.category, ErrorCategory.MODEL_UNAVAILABLE);
  assert.strictEqual(
    c.blacklistProvider,
    false,
    'l\'indisponibilité d\'UN modèle ne doit pas ouvrir le circuit GLOBAL du fournisseur',
  );
  assert.strictEqual(c.retryable, true, 'le fallback reste autorisé');
  assert.strictEqual(c.skipToNextKey, true, 'on écarte le couple provider/modèle, pas le fournisseur');
});

test('AUTH_ERROR : politique explicite (clé blacklistée ET fournisseur pénalisé)', () => {
  const c = classifyError(new Error('401 Unauthorized: invalid api key'));
  assert.strictEqual(c.category, ErrorCategory.AUTH_ERROR);
  assert.strictEqual(c.blacklistKey, true, 'la clé morte est blacklistée');
  assert.strictEqual(c.cooldownMs, 24 * 60 * 60 * 1000, 'cooldown clé de 24 h');
  assert.strictEqual(c.blacklistProvider, true, 'un fournisseur qui rejette nos identifiants est inutilisable pour nous');
  assert.strictEqual(c.retryable, false, 'ce n\'est pas une panne transitoire à retenter');
});

test('la règle est exposée par CLASSIFICATION_RULES (pas de duplication)', () => {
  assert.strictEqual(CLASSIFICATION_RULES[ErrorCategory.INVALID_REQUEST].blacklistProvider, false);
  assert.strictEqual(CLASSIFICATION_RULES[ErrorCategory.CONTENT_POLICY].blacklistProvider, false);
  assert.strictEqual(CLASSIFICATION_RULES[ErrorCategory.TIMEOUT].blacklistProvider, true);
  assert.strictEqual(CLASSIFICATION_RULES[ErrorCategory.AUTH_ERROR].blacklistProvider, true);
});

// ─── TEST 1 : INVALID_REQUEST n'incrémente aucun compteur ────────
console.log('\nTest 1: INVALID_REQUEST n\'incrémente pas le compteur d\'échecs');

test('1. INVALID_REQUEST ne pénalise ni le fournisseur ni la clé', () => {
  const systems = makeSystems();
  const classified = classifyError(new Error('400 Bad Request: invalid argument'));
  assert.strictEqual(classified.category, ErrorCategory.INVALID_REQUEST);

  const penalized = applyProviderFailure(classified, systems, { platform: 'google', keyId: 'key-google' });

  assert.strictEqual(penalized, false, 'aucune pénalité appliquée');
  assert.strictEqual(systems.health.getHealth('google').failureCount, 0, 'health monitor intact');
  assert.strictEqual(systems.health.getHealth('google').totalRequests, 0, 'aucune requête comptée');
  assert.strictEqual(systems.cb.getBreaker('google').failureCount, 0, 'Circuit Breaker intact');
  assert.strictEqual(systems.perf.failures.length, 0, 'métriques de performance intactes');
  assert.strictEqual(systems.keyPool.failures.length, 0, 'aucun cooldown de clé');
});

// ─── TEST 2 : erreur client répétée ≠ Circuit Breaker ouvert ─────
console.log('\nTest 2: une erreur client répétée ne peut pas ouvrir le Circuit Breaker');

test('2. 30 requêtes malformées laissent le circuit fermé', () => {
  const systems = makeSystems();

  for (let i = 0; i < 30; i++) {
    applyProviderFailure(
      classifyError(new Error('400 Bad Request: malformed JSON body')),
      systems,
      { platform: 'kilo', keyId: `key-${i}` }
    );
  }

  const breaker = systems.cb.getBreaker('kilo');
  assert.strictEqual(breaker.failureCount, 0, 'compteur d\'échecs resté à 0');
  assert.strictEqual(breaker.state, CIRCUIT_STATES.CLOSED, 'circuit toujours fermé');
  assert.strictEqual(breaker.openCount, 0, 'jamais ouvert');
  assert.strictEqual(systems.cb.isAvailable('kilo'), true, 'le fournisseur reste disponible');
  assert.strictEqual(systems.health.getHealth('kilo').successRate, 1.0, 'santé non dégradée');
});

// ─── TEST 3 : vrai timeout fournisseur → pénalité ────────────────
console.log('\nTest 3: un vrai timeout fournisseur incrémente le compteur');

test('3. timeout fournisseur → compteurs incrémentés et circuit ouvrable', () => {
  const systems = makeSystems();
  const classified = classifyError(timeoutAbortError());
  assert.strictEqual(classified.category, ErrorCategory.TIMEOUT);

  applyProviderFailure(classified, systems, { platform: 'ovh', keyId: 'key-ovh' });

  assert.strictEqual(systems.cb.getBreaker('ovh').failureCount, 1, 'Circuit Breaker incrémenté');
  assert.strictEqual(systems.health.getHealth('ovh').failureCount, 1, 'health monitor incrémenté');
  assert.strictEqual(systems.perf.failures.length, 1, 'métriques incrémentées');
  assert.strictEqual(systems.keyPool.failures.length, 1, 'clé refroidie');

  // 5 timeouts consécutifs → le fournisseur est bien écarté (comportement voulu).
  for (let i = 0; i < 4; i++) {
    applyProviderFailure(classifyError(timeoutAbortError()), systems, { platform: 'ovh' });
  }
  assert.strictEqual(systems.cb.getBreaker('ovh').state, CIRCUIT_STATES.OPEN);
  assert.strictEqual(systems.cb.isAvailable('ovh'), false);
});

// ─── TEST 4 : erreur serveur fournisseur → pénalité ──────────────
console.log('\nTest 4: une erreur serveur fournisseur incrémente le compteur');

test('4. erreur 5xx fournisseur → compteurs incrémentés', () => {
  const systems = makeSystems();
  const classified = classifyError(new Error('503 Service Unavailable'));
  assert.strictEqual(classified.category, ErrorCategory.SERVER_ERROR);
  assert.strictEqual(classified.blacklistProvider, true);

  applyProviderFailure(classified, systems, { platform: 'cloudflare', keyId: 'key-cf' });

  assert.strictEqual(systems.cb.getBreaker('cloudflare').failureCount, 1);
  assert.strictEqual(systems.health.getHealth('cloudflare').failureCount, 1);
  assert.strictEqual(systems.perf.failures.length, 1);
  assert.strictEqual(systems.keyPool.failures.length, 1);
});

// ─── TEST 5 : déconnexion client → aucune pénalité ───────────────
console.log('\nTest 5: une déconnexion client ne pénalise pas le fournisseur');

test('5. AbortError de déconnexion client → aucune pénalité', () => {
  const systems = makeSystems();
  const outcome = handleProviderError(timeoutAbortError(), {
    clientDisconnected: true,
    platform: 'google',
    systems,
  });

  assert.strictEqual(outcome, 'client_aborted', 'la requête est classée comme abandonnée');
  assert.strictEqual(systems.health.getHealth('google').failureCount, 0);
  assert.strictEqual(systems.cb.getBreaker('google').failureCount, 0);
  assert.strictEqual(systems.perf.failures.length, 0);
  assert.strictEqual(systems.keyPool.failures.length, 0);
});

test('5bis. le MÊME AbortError sans déconnexion client est un vrai timeout pénalisé', () => {
  // Seul `clientDisconnected` distingue les deux cas : le classifieur produit une
  // AbortError identique pour un timeout du timer local de fetchWithTimeout.
  const systems = makeSystems();
  const outcome = handleProviderError(timeoutAbortError(), {
    clientDisconnected: false,
    platform: 'google',
    systems,
  });

  assert.strictEqual(outcome, ErrorCategory.TIMEOUT);
  assert.strictEqual(systems.cb.getBreaker('google').failureCount, 1, 'le timeout est bien comptabilisé');
});

// ─── TEST 6 : politique AUTH_ERROR ───────────────────────────────
console.log('\nTest 6: une erreur d\'authentification suit la politique retenue');

test('6. AUTH_ERROR → clé blacklistée et fournisseur pénalisé', () => {
  const systems = makeSystems();
  const classified = classifyError(new Error('401 Unauthorized'), 'openai');
  assert.strictEqual(classified.category, ErrorCategory.AUTH_ERROR);

  const penalized = applyProviderFailure(classified, systems, { platform: 'openai', keyId: 'key-dead' });

  assert.strictEqual(penalized, true);
  assert.strictEqual(systems.keyPool.failures[0], 'openai/key-dead', 'la clé est signalée au KeyPool (blacklist 24 h)');
  assert.strictEqual(systems.cb.getBreaker('openai').failureCount, 1, 'fournisseur pénalisé (cohérence cbV2 / keyPool)');
  assert.strictEqual(systems.health.getHealth('openai').failureCount, 1);
});

// ─── TEST 7 : le fallback continue de fonctionner ────────────────
console.log('\nTest 7: les mécanismes de fallback restent fonctionnels');

test('7. timeout / 5xx / 429 déclenchent le fallback, INVALID_REQUEST échoue sans balayer la chaîne', () => {
  const state = new RetryState({ maxRetries: 4 });

  assert.strictEqual(state.recordAttempt(new Error('ETIMEDOUT'), 'google', 'k1').action, 'fallback');
  assert.strictEqual(state.recordAttempt(new Error('500 Internal Server Error'), 'kilo', 'k2').action, 'fallback');
  assert.strictEqual(state.recordAttempt(new Error('429 Too Many Requests'), 'ovh', 'k3').action, 'fallback');
  assert.strictEqual(state.fallbackCount, 3, 'les erreurs fournisseur ont bien basculé');

  // Une vraie erreur de requête ne doit pas consommer le budget de fallback :
  // elle échouerait de la même façon chez tous les fournisseurs.
  const invalid = state.recordAttempt(new Error('400 Bad Request: malformed JSON body'), 'llm7', 'k4');
  assert.strictEqual(invalid.action, 'fail');
  assert.strictEqual(state.fallbackCount, 3, 'aucun fallback supplémentaire consommé');
});

test('7bis. un modèle indisponible (400) part bien en fallback sans pénaliser le fournisseur', () => {
  const state = new RetryState({ maxRetries: 4 });
  const classified = classifyError(new Error('400 Bad Request: model gemini-x is not a valid model ID'), 'google');
  assert.strictEqual(classified.category, ErrorCategory.MODEL_UNAVAILABLE);
  assert.strictEqual(
    classified.blacklistProvider,
    false,
    'un modèle indisponible ne doit pas dégrader la santé globale du fournisseur',
  );

  const decision = state.recordAttempt(new Error('400 Bad Request: model gemini-x is not a valid model ID'), 'google', 'k1');
  assert.strictEqual(decision.action, 'fallback', 'le fallback reste déclenché');
});

// ─── TEST 8 : un modèle mort n'ouvre pas le circuit du fournisseur (A) ──
console.log('\nTest 8: un modèle indisponible ne dégrade pas les autres modèles du fournisseur');

test('8. 30 erreurs de modèle indisponible laissent le fournisseur sain (les autres modèles restent routables)', () => {
  const systems = makeSystems();
  const modelErr = new Error('Google API error 404: model gemini-1.5 is not found');
  assert.strictEqual(classifyError(modelErr).category, ErrorCategory.MODEL_UNAVAILABLE);

  const state = new RetryState({ maxRetries: 4 });
  for (let i = 0; i < 30; i++) {
    // Le proxy applique la règle du classifieur : blacklistProvider === false
    // → aucune pénalité, mais la décision de fallback est prise indépendamment.
    applyProviderFailure(classifyError(modelErr), systems, { platform: 'google', keyId: `key-${i}` });
  }

  assert.strictEqual(systems.cb.getBreaker('google').failureCount, 0, 'Circuit Breaker V2 intact');
  assert.strictEqual(systems.cb.isAvailable('google'), true, 'le fournisseur reste disponible pour ses autres modèles');
  assert.strictEqual(systems.health.getHealth('google').failureCount, 0, 'health monitor intact');
  assert.strictEqual(systems.health.getHealth('google').totalRequests, 0, 'aucune requête comptée comme échec');
  assert.strictEqual(systems.perf.failures.length, 0, 'métriques intactes');
  assert.strictEqual(systems.keyPool.failures.length, 0, 'aucun cooldown de clé');

  // Le fallback n'est pas perdu pour autant.
  assert.strictEqual(
    state.recordAttempt(modelErr, 'google', 'k1').action,
    'fallback',
    'le couple provider/modèle est écarté et la chaîne continue',
  );
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
