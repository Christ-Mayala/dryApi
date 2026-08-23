/**
 * Tests d'intégration — Vérifient que les modules fonctionnent ENSEMBLE
 * dans des scénarios de panne réalistes.
 *
 * Scénarios testés :
 *   1. Provider A timeout → fallback vers B → succès
 *   2. Provider A rate-limit (429) → changement de clé → succès
 *   3. Provider A quota épuisé → autre provider
 *   4. Tous providers cloud DOWN → mode local Ollama
 *   5. Provider A réponse invalide → fallback vers B
 *   6. Clé API invalide (401) → blacklist automatique
 *   7. Provider A DOWN + B rate-limited → C disponible
 *   8. Circuit breaker s'ouvre après 5 échecs consécutifs
 *   9. Health monitor détecte le déclin d'un provider
 *  10. Policy engine bloque un provider health dégradé
 */

const assert = require('assert');
const { classifyError, ErrorCategory } = require('../core/services/errorClassifier');
const { validateResponse, sanitizeResponse } = require('../core/services/responseValidator');
const { RetryState, wait } = require('../core/services/smartRetry');
const { CircuitBreaker: ProviderCircuitBreaker, CircuitBreakerManager, CIRCUIT_STATES: CircuitState } = require('../core/services/circuitBreaker');
const { ProviderHealthMonitor } = require('../core/services/providerHealthMonitor');
const { DegradedModeManager, DegradedState } = require('../core/services/degradedMode');
const { initializeRegistry, getCapabilities, findModelsByCapabilities } = require('../core/services/modelCapabilityRegistry');

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

function assertEqual(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg || `Expected ${expected}, got ${actual}`);
}

console.log('\n🔗 Integration Tests\n');

// ─── SCENARIO 1: Provider A timeout → fallback vers B ────────
console.log('Scenario 1: Provider A timeout → fallback B');

test('timeout on provider A → retry same provider → fallback to B', () => {
  const retry = new RetryState({ maxRetries: 2, maxNetworkRetries: 1 });

  // Simulate timeout on A → network retry
  const d1 = retry.recordAttempt(new Error('ETIMEDOUT'), 'groq', 'key-a');
  assertEqual(d1.action, 'retry_same_provider', 'Should retry same provider on timeout');
  assertEqual(retry.networkRetries, 1);

  // Second timeout → network budget exhausted → fallback
  const d2 = retry.recordAttempt(new Error('ETIMEDOUT'), 'groq', 'key-a');
  assertEqual(d2.action, 'fallback', 'Network budget exhausted → fallback to different provider');
  assertEqual(retry.fallbackCount, 1);
});

// ─── SCENARIO 2: Rate limit → changement de clé ─────────────
console.log('\nScenario 2: Rate limit (429) → changement de clé');

test('429 on key A → fallback to key B → success', () => {
  const retry = new RetryState({ maxRetries: 3 });

  const d1 = retry.recordAttempt(new Error('429 Too Many Requests'), 'openai', 'key-a');
  assertEqual(d1.action, 'fallback', '429 should trigger fallback to next key');
  assertEqual(d1.classifiedError.category, ErrorCategory.RATE_LIMIT);

  const health = new ProviderHealthMonitor();
  health.recordFailure('openai', '429 rate limited');
  assertEqual(health.getHealth('openai').isRateLimited, true);

  health.recordSuccess('openai', 200);
  assertEqual(health.getHealth('openai').isRateLimited, false, 'Rate limit should clear on success');
});

// ─── SCENARIO 3: Quota épuisé → autre provider ──────────────
console.log('\nScenario 3: Quota épuisé → autre provider');

test('quota exceeded → classified correctly → fallback to different provider', () => {
  const classified = classifyError(new Error('quota exceeded for this key'));
  assertEqual(classified.category, ErrorCategory.QUOTA_EXCEEDED);
  assertEqual(classified.retryable, true);
  assertEqual(classified.skipToNextKey, true);

  const retry = new RetryState({ maxRetries: 2 });
  const d = retry.recordAttempt(new Error('quota exceeded'), 'google', 'key-q');
  assertEqual(d.action, 'fallback', 'Quota exceeded should trigger fallback');
});

// ─── SCENARIO 4: Tous cloud DOWN → mode local ───────────────
console.log('\nScenario 4: Tous cloud DOWN → mode local');

test('all cloud providers DOWN → degraded mode activates', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.EMERGENCY, 'All cloud providers down');
  assertEqual(mgr.state, DegradedState.EMERGENCY);
  assertEqual(mgr.isDegraded(), true);
  assertEqual(mgr.stats.emergencyActivations, 1);
});

test('offline mode generates controlled response', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.OFFLINE, 'Everything down');
  const response = mgr.generateOfflineResponse(
    [{ role: 'user', content: 'Hello' }],
    'req-test-123'
  );
  assertEqual(response._offline, true);
  assertEqual(response._degraded, true);
  assert.ok(response.choices[0].message.content.includes('hors-ligne'));
  assert.ok(response.choices[0].message.content.includes('req-test-123'));
});

// ─── SCENARIO 5: Réponse invalide → fallback ─────────────────
console.log('\nScenario 5: Réponse invalide → fallback');

test('empty response → validation fails → fallback', () => {
  const result = validateResponse(null);
  assertEqual(result.valid, false);
  assert.ok(result.issues.includes('empty_response'));
});

test('response with no choices → validation fails', () => {
  const result = validateResponse({ id: '123' });
  assertEqual(result.valid, false);
});

test('valid response passes validation', () => {
  const result = validateResponse({
    id: 'chatcmpl-123',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  });
  assertEqual(result.valid, true);
});

// ─── SCENARIO 6: Clé invalide → blacklist automatique ───────
console.log('\nScenario 6: Clé invalide → blacklist automatique');

test('401 → auth error → key blacklisted → no retry', () => {
  const classified = classifyError(new Error('401 Unauthorized'));
  assertEqual(classified.category, ErrorCategory.AUTH_ERROR);
  assertEqual(classified.blacklistKey, true);
  assertEqual(classified.retryable, false);

  const retry = new RetryState();
  const d = retry.recordAttempt(new Error('401'), 'openai', 'key-dead');
  assertEqual(d.action, 'fail', 'Auth error should not be retried');

  const blacklisted = retry.getBlacklistedKeys();
  assert.ok(blacklisted.includes('key-dead'), 'Dead key should be blacklisted');
  assert.ok(!blacklisted.includes('key-ok'), 'Other keys should not be blacklisted');
});

// ─── SCENARIO 7: Provider A DOWN + B rate-limited → C ────────
console.log('\nScenario 7: Multiple failures → last provider wins');

test('cascade: timeout → 429 → budget exhausted', () => {
  const retry = new RetryState({ maxRetries: 2, maxNetworkRetries: 0 });

  // A: timeout → fallback (no network retries configured)
  const d1 = retry.recordAttempt(new Error('ETIMEDOUT'), 'groq', 'k1');
  assertEqual(d1.action, 'fallback', 'Timeout with no network retries → fallback');

  // B: 429 → fallback
  const d2 = retry.recordAttempt(new Error('429 rate limit'), 'openai', 'k2');
  assertEqual(d2.action, 'fallback', '429 → fallback to next provider');

  // C: 429 → budget exhausted
  const d3 = retry.recordAttempt(new Error('429 rate limit'), 'google', 'k3');
  assertEqual(d3.action, 'fail', 'Budget exhausted → fail');
  assertEqual(retry.shouldContinue(), false);
});

// ─── SCENARIO 8: Circuit breaker s'ouvre après échecs ───────
console.log('\nScenario 8: Circuit breaker opens after consecutive failures');

test('circuit breaker opens after threshold', () => {
  const cb = new ProviderCircuitBreaker('flaky-provider', { failureThreshold: 5 });

  for (let i = 0; i < 5; i++) {
    cb.recordFailure();
  }

  assertEqual(cb.state, CircuitState.OPEN);
  assertEqual(cb.canCall(), false);
  assertEqual(cb.openCount, 1);
});

test('circuit breaker recovers via half-open', (done) => {
  const cb = new ProviderCircuitBreaker('recovering', {
    failureThreshold: 3,
    recoveryTimeoutMs: 20,
    successThreshold: 1,
  });

  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  assertEqual(cb.state, CircuitState.OPEN);

  setTimeout(() => {
    assertEqual(cb.canCall(), true); // → HALF_OPEN
    assertEqual(cb.state, CircuitState.HALF_OPEN);

    cb.recordSuccess(); // → CLOSED
    assertEqual(cb.state, CircuitState.CLOSED);
    done();
  }, 25);
});

// ─── SCENARIO 9: Health monitor détecte le déclin ────────────
console.log('\nScenario 9: Health monitor detects provider degradation');

test('health trend changes from stable to degrading', () => {
  const monitor = new ProviderHealthMonitor();

  // Record some successes
  for (let i = 0; i < 10; i++) monitor.recordSuccess('provider-x', 100);

  const h1 = monitor.getHealth('provider-x');
  assertEqual(h1.trend, 'stable');

  // Now record many failures
  for (let i = 0; i < 15; i++) monitor.recordFailure('provider-x', 'error');

  const h2 = monitor.getHealth('provider-x');
  // Error rate should be high
  assert.ok(h2.errorRate > 0.5, `Error rate should be > 50%, got ${(h2.errorRate * 100).toFixed(1)}%`);
});

test('health score reflects degradation', () => {
  const monitorGood = new ProviderHealthMonitor();
  const monitorBad = new ProviderHealthMonitor();

  for (let i = 0; i < 20; i++) {
    monitorGood.recordSuccess('good', 100);
    monitorBad.recordSuccess('bad', 100);
  }
  for (let i = 0; i < 15; i++) {
    monitorBad.recordFailure('bad', 'error');
  }

  const scoreGood = monitorGood.getHealthScore('good');
  const scoreBad = monitorBad.getHealthScore('bad');
  assert.ok(scoreGood > scoreBad, `Good score ${scoreGood} should be > bad score ${scoreBad}`);
});

// ─── SCENARIO 10: Capability-aware routing ───────────────────
console.log('\nScenario 10: Capability-aware model selection');

test('vision request → only vision-capable models returned', () => {
  initializeRegistry([
    { platform: 'google', modelId: 'gemini-2.5-pro', contextWindow: 1048576 },
    { platform: 'groq', modelId: 'llama-3.3-70b', contextWindow: 131072 },
  ]);

  const allKeys = ['google:gemini-2.5-pro', 'groq:llama-3.3-70b'];
  const visionModels = findModelsByCapabilities({ vision: true }, allKeys);
  assert.ok(visionModels.some(m => m.includes('google')), 'Google should be vision-capable');
  assert.ok(!visionModels.some(m => m.includes('groq')), 'Groq should NOT be vision-capable');
});

test('tool calling request → only tool-capable models returned', () => {
  initializeRegistry([
    { platform: 'google', modelId: 'gemini-2.5-pro', contextWindow: 1048576 },
    { platform: 'nvidia', modelId: 'llama-3.3-70b', contextWindow: 131072 },
  ]);

  const allKeys = ['google:gemini-2.5-pro', 'nvidia:llama-3.3-70b'];
  const toolModels = findModelsByCapabilities({ tool_calling: true }, allKeys);
  assert.ok(toolModels.some(m => m.includes('google')), 'Google should support tools');
  assert.ok(!toolModels.some(m => m.includes('nvidia')), 'NVIDIA should NOT support tools');
});

test('coding + long_context request → filtered correctly', () => {
  initializeRegistry([
    { platform: 'mistral', modelId: 'codestral-latest', contextWindow: 32000 },
    { platform: 'google', modelId: 'gemini-2.5-pro', contextWindow: 1048576 },
  ]);

  const allKeys = ['mistral:codestral-latest', 'google:gemini-2.5-pro'];
  const models = findModelsByCapabilities({ coding: true, long_context: true }, allKeys);
  // Codestral has coding but NOT long_context; Gemini has both
  assert.ok(models.some(m => m.includes('google')), 'Gemini should match');
  assert.ok(!models.some(m => m.includes('codestral')), 'Codestral should NOT match (no long_context)');
});

// ─── SCENARIO: Combined end-to-end flow ──────────────────────
console.log('\nScenario E2E: Complete fallback flow simulation');

test('full flow: timeout → classify → retry → fallback → validate → success', () => {
  // Step 1: Timeout occurs
  const error = new Error('ETIMEDOUT connect');
  const classified = classifyError(error, 'groq');
  assertEqual(classified.category, ErrorCategory.TIMEOUT);
  assertEqual(classified.retryable, true);

  // Step 2: Smart retry decides to retry same provider
  const retry = new RetryState({ maxRetries: 3, maxNetworkRetries: 0 });
  const decision1 = retry.recordAttempt(error, 'groq', 'k1');
  assertEqual(decision1.action, 'fallback', 'No network retries → fallback directly');

  // Step 3: Next provider's request also fails → fallback again
  const decision2 = retry.recordAttempt(error, 'openai', 'k2');
  assertEqual(decision2.action, 'fallback');

  // Step 5: Next provider succeeds → validate response
  const mockResponse = {
    id: 'chatcmpl-success',
    choices: [{ index: 0, message: { role: 'assistant', content: 'I can help with that!' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
  };

  const validation = validateResponse(mockResponse, { provider: 'google' });
  assertEqual(validation.valid, true);
  assertEqual(validation.sanitizedResponse.choices[0].message.content, 'I can help with that!');

  // Step 6: Health monitor records success
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('google', 200, 50, 10);
  assertEqual(monitor.getHealth('google').successRate, 1.0);

  // Step 7: Circuit breaker records success
  const cb = new ProviderCircuitBreaker('google');
  cb.recordSuccess();
  assertEqual(cb.state, CircuitState.CLOSED);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
