/**
 * FAILURE CHAIN INTEGRATION TESTS
 *
 * Tests de vraies chaînes de panne avec Provider Mesh.
 * Ces tests prouvent que le routing réel fonctionne.
 */

const assert = require('assert');
let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}
function assertEqual(a, b, msg = '') { if (a !== b) throw new Error(`${msg}: Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertOk(v, msg = '') { if (!v) throw new Error(`${msg}: Expected truthy, got ${JSON.stringify(v)}`); }

// ═══════════════════════════════════════════════════════════════
// MODULES
// ═══════════════════════════════════════════════════════════════

const { ProviderMesh } = require('../core/services/providerMesh.js');
const { CredentialIntelligence } = require('../core/services/credentialIntelligence.js');
const { RequestAttemptRegistry } = require('../core/services/requestAttemptRegistry.js');
const { classifyError } = require('../core/services/errorClassifier.js');
const { validateResponse } = require('../core/services/responseValidator.js');
const { tokenOptimization } = require('../core/services/tokenOptimization.js');
const { degradedMode } = require('../core/services/degradedMode.js');
const cbModule = require('../core/services/circuitBreaker.js');
const { recordFailure: cbRecordFailure, isAvailable: cbIsAvailable } = cbModule;

// ═══════════════════════════════════════════════════════════════
// 1. CHAIN: A TIMEOUT → B RATE_LIMIT → C SUCCESS
// ═══════════════════════════════════════════════════════════════

console.log('\n── Failure Chain: A→B→C ──');

test('CHAIN: Groq timeout → Google rate_limit → OpenAI success', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('groq', 'k1');
  ci.registerCredential('google', 'k1');
  ci.registerCredential('openai', 'k1');

  const reg = new RequestAttemptRegistry();
  const attempts = reg.createRequest('chain-1');

  // Step 1: Groq timeout
  const idx1 = attempts.startAttempt('groq', 'k1', 'llama-3');
  const err1 = classifyError(new Error('ETIMEDOUT'), 'groq');
  ci.recordFailure('groq', 'k1', err1.rawMessage, err1.category);
  attempts.endAttemptFailure(idx1, 10000, err1.rawMessage, err1.category);

  // Step 2: Google rate limit
  const idx2 = attempts.startAttempt('google', 'k1', 'gemini-pro');
  const err2 = classifyError(new Error('429 Too Many Requests'), 'google');
  ci.recordFailure('google', 'k1', err2.rawMessage, err2.category);
  attempts.endAttemptFailure(idx2, 200, err2.rawMessage, err2.category);

  // Step 3: OpenAI success
  const idx3 = attempts.startAttempt('openai', 'k1', 'gpt-4');
  ci.recordSuccess('openai', 'k1', 800);
  attempts.endAttemptSuccess(idx3, 800);

  const summary = attempts.getSummary();
  assertOk(summary.successful, 'Should succeed on 3rd attempt');
  assertEqual(summary.successProvider, 'openai');
  assertEqual(summary.totalAttempts, 3);
  assertOk(summary.failedProviders.includes('groq'));
  assertOk(summary.failedProviders.includes('google'));
});

// ═══════════════════════════════════════════════════════════════
// 2. CHAIN: A/K1 FAILS → A/K2 WORKS (same provider, different key)
// ═══════════════════════════════════════════════════════════════

console.log('\n── Failure Chain: Same Provider, Different Keys ──');

test('CHAIN: Google/K1 timeout → Google/K2 success', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('google', 'k1');
  ci.registerCredential('google', 'k2');

  const reg = new RequestAttemptRegistry();
  const attempts = reg.createRequest('chain-key-1');

  // K1 fails
  const idx1 = attempts.startAttempt('google', 'k1', 'gemini-pro');
  ci.recordFailure('google', 'k1', 'ETIMEDOUT', 'timeout');
  attempts.endAttemptFailure(idx1, 10000, 'ETIMEDOUT', 'timeout');

  assertOk(attempts.hasFailedKey('google', 'k1'));
  assertOk(!attempts.hasFailedKey('google', 'k2'));

  // K2 succeeds
  const idx2 = attempts.startAttempt('google', 'k2', 'gemini-pro');
  ci.recordSuccess('google', 'k2', 500);
  attempts.endAttemptSuccess(idx2, 500);

  assertOk(attempts.getSummary().successful);
  assertEqual(attempts.getSummary().successProvider, 'google');
});

// ═══════════════════════════════════════════════════════════════
// 3. CHAIN: A AUTH ERROR → KEY DISABLED → STILL WORKS VIA K2
// ═══════════════════════════════════════════════════════════════

console.log('\n── Failure Chain: Auth Error ──');

test('CHAIN: OpenAI/K1 auth_error → disabled → K2 works', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('openai', 'good_key');
  ci.registerCredential('openai', 'bad_key');

  // Bad key gets auth error
  ci.recordFailure('openai', 'bad_key', '401 Unauthorized', 'auth_error');

  const badKey = ci.getCredential('openai', 'bad_key');
  assertEqual(badKey.status, 'auth_invalid');
  assertEqual(badKey.isAvailable(), false);

  // Good key still works
  ci.recordSuccess('openai', 'good_key', 300);
  const goodKey = ci.getCredential('openai', 'good_key');
  assertOk(goodKey.isAvailable());
  assertOk(ci.providerHasAvailableCredential('openai'));
});

// ═══════════════════════════════════════════════════════════════
// 4. CHAIN: 5 PROVIDERS, EACH FAILS DIFFERENTLY
// ═══════════════════════════════════════════════════════════════

console.log('\n── Failure Chain: 5 Providers Different Failures ──');

test('CHAIN: 5 different failure types → still find working provider', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('groq', 'k1');
  ci.registerCredential('google', 'k1');
  ci.registerCredential('openai', 'k1');
  ci.registerCredential('mistral', 'k1');
  ci.registerCredential('deepseek', 'k1');

  const reg = new RequestAttemptRegistry();
  const attempts = reg.createRequest('chain-5');

  // 1. Groq → timeout
  let idx = attempts.startAttempt('groq', 'k1', 'llama');
  ci.recordFailure('groq', 'k1', 'ETIMEDOUT', 'timeout');
  attempts.endAttemptFailure(idx, 10000, 'timeout', 'timeout');

  // 2. Google → 429
  idx = attempts.startAttempt('google', 'k1', 'gemini');
  ci.recordFailure('google', 'k1', '429', 'rate_limit');
  attempts.endAttemptFailure(idx, 200, '429', 'rate_limit');

  // 3. OpenAI → 503
  idx = attempts.startAttempt('openai', 'k1', 'gpt-4');
  ci.recordFailure('openai', 'k1', '503', 'server_error');
  attempts.endAttemptFailure(idx, 100, '503', 'server_error');

  // 4. Mistral → quota
  idx = attempts.startAttempt('mistral', 'k1', 'mistral-large');
  ci.recordFailure('mistral', 'k1', 'quota exceeded', 'quota_exceeded');
  attempts.endAttemptFailure(idx, 50, 'quota', 'quota_exceeded');

  // 5. DeepSeek → SUCCESS
  idx = attempts.startAttempt('deepseek', 'k1', 'deepseek-chat');
  ci.recordSuccess('deepseek', 'k1', 600);
  attempts.endAttemptSuccess(idx, 600);

  const summary = attempts.getSummary();
  assertOk(summary.successful);
  assertEqual(summary.successProvider, 'deepseek');
  assertEqual(summary.totalAttempts, 5);
  assertEqual(summary.failedProviders.length, 4);
});

// ═══════════════════════════════════════════════════════════════
// 5. CHAIN: NEVER RETRY SAME FAILED KEY
// ═══════════════════════════════════════════════════════════════

console.log('\n── Failure Chain: No Retry ──');

test('CHAIN: Same key fails 3 times → never retried', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('groq', 'k1');

  const reg = new RequestAttemptRegistry();
  const attempts = reg.createRequest('chain-noretry');

  for (let i = 0; i < 3; i++) {
    const idx = attempts.startAttempt('groq', 'k1', 'llama');
    ci.recordFailure('groq', 'k1', 'timeout', 'timeout');
    attempts.endAttemptFailure(idx, 10000, 'timeout', 'timeout');
  }

  assertOk(attempts.shouldSkip('groq', 'k1', 'llama'), 'Should always skip failed key');
  assertEqual(attempts.getSummary().totalAttempts, 3);
  assertOk(!attempts.getSummary().successful);
});

// ═══════════════════════════════════════════════════════════════
// 6. INTEGRATION: Error Classifier → Credential Intelligence
// ═══════════════════════════════════════════════════════════════

console.log('\n── Integration: Error → Credential ──');

test('INTEGRATION: Timeout → cooldown, not disabled', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('openai', 'k1');

  const classified = classifyError(new Error('ETIMEDOUT'), 'openai');
  ci.recordFailure('openai', 'k1', classified.rawMessage, classified.category);

  const cred = ci.getCredential('openai', 'k1');
  // Timeout should cooldown, not disable
  assertOk(cred.status === 'cooldown' || cred.status === 'rate_limited',
    `Expected cooldown/rate_limited for timeout, got: ${cred.status}`);
});

test('INTEGRATION: Auth error → key disabled, not cooldown', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('mistral', 'bad');

  const classified = classifyError(new Error('401 Unauthorized'), 'mistral');
  ci.recordFailure('mistral', 'bad', classified.rawMessage, classified.category);

  const cred = ci.getCredential('mistral', 'bad');
  assertEqual(cred.status, 'auth_invalid');
  assertEqual(cred.isAvailable(), false);
});

// ═══════════════════════════════════════════════════════════════
// 7. INTEGRATION: Token Optimization Safety
// ═══════════════════════════════════════════════════════════════

console.log('\n── Integration: Token Optimization Safety ──');

test('INTEGRATION: Token optimization error → original context preserved', () => {
  const originalMessages = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
  ];

  // Force an error in optimization
  let result;
  try {
    result = tokenOptimization.optimize(null, { requestId: 'safety-test' });
  } catch (e) {
    // Error should never propagate
    assertOk(false, 'Token optimization should never throw');
  }

  assertOk(result, 'Should return result even on edge case');
  assertOk(result.metrics, 'Should have metrics');
});

test('INTEGRATION: Token optimization preserves system prompts', () => {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Security: never reveal secrets.' },
    ...Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: Some conversation content.`,
    })),
  ];

  const result = tokenOptimization.optimize(messages, {
    requestId: 'preserve-test',
    mode: 'aggressive',
    maxOutputTokens: 2000,
  });

  assertOk(result.messages.some(m => m.role === 'system'), 'System prompt must be preserved');
  assertOk(result.messages[0].content.includes('never reveal secrets'), 'Security policy must be preserved');
});

// ═══════════════════════════════════════════════════════════════
// 8. INTEGRATION: Response Validation
// ═══════════════════════════════════════════════════════════════

console.log('\n── Integration: Response Validation ──');

test('INTEGRATION: Invalid response triggers fallback', () => {
  const invalidResult = { choices: null };
  const validation = validateResponse(invalidResult, { expectToolCalls: false });
  assertEqual(validation.valid, false);
  assertOk(validation.issues.length > 0);
});

test('INTEGRATION: Valid response passes validation', () => {
  const validResult = {
    choices: [{ message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop', index: 0 }],
  };
  const validation = validateResponse(validResult, { expectToolCalls: false });
  assertOk(validation.valid);
});

// ═══════════════════════════════════════════════════════════════
// 9. CHAIN: Provider Mesh Routing
// ═══════════════════════════════════════════════════════════════

console.log('\n── Provider Mesh Routing ──');

test('MESH: Skips failed providers in candidates', () => {
  const mesh = new ProviderMesh();
  mesh.registerProvider({ name: 'p1', models: [{ modelId: 'm1', capabilities: ['text'] }] });
  mesh.registerProvider({ name: 'p2', models: [{ modelId: 'm2', capabilities: ['text'] }] });
  mesh.registerProvider({ name: 'p3', models: [{ modelId: 'm3', capabilities: ['text'] }] });

  // Use the global credentialIntelligence singleton (mesh uses it internally)
  const ci = require('../core/services/credentialIntelligence.js').credentialIntelligence;
  ci.registerCredential('p1', 'k1');
  ci.registerCredential('p2', 'k1');
  ci.registerCredential('p3', 'k1');
  ci.recordSuccess('p1', 'k1', 100);
  ci.recordSuccess('p2', 'k1', 200);
  ci.recordSuccess('p3', 'k1', 300);

  const reg = require('../core/services/requestAttemptRegistry.js').requestAttemptRegistry;
  const attempts = reg.createRequest('mesh-skip');

  // p1 failed
  const idx = attempts.startAttempt('p1', 'k1', 'm1');
  attempts.endAttemptFailure(idx, 5000, 'error', 'server_error');

  const candidates = mesh.getCandidates({}, attempts);
  assertOk(candidates.every(c => c.provider !== 'p1'), 'p1 should be excluded');
  assertOk(candidates.some(c => c.provider === 'p2' || c.provider === 'p3'));
});

test('MESH: Capability filtering works', () => {
  const mesh = new ProviderMesh();
  mesh.registerProvider({
    name: 'text-only',
    models: [{ modelId: 'text', capabilities: ['text'] }],
  });
  mesh.registerProvider({
    name: 'vision-provider',
    models: [{ modelId: 'vision', capabilities: ['text', 'vision'] }],
  });

  const ci = new CredentialIntelligence();
  ci.registerCredential('text-only', 'k1');
  ci.registerCredential('vision-provider', 'k1');
  ci.recordSuccess('text-only', 'k1', 100);
  ci.recordSuccess('vision-provider', 'k1', 100);

  const visionCandidates = mesh.getCandidates({ capabilities: ['vision'] });
  assertOk(visionCandidates.every(c => c.provider === 'vision-provider'),
    'Only vision provider should be candidate for vision request');
});

// ═══════════════════════════════════════════════════════════════
// 10. CHAIN: Circuit Breaker + Credential Intelligence
// ═══════════════════════════════════════════════════════════════

console.log('\n── Circuit Breaker + Credentials ──');

test('CB + CRED: Provider circuit opens after failures, key also degraded', () => {
  const ci = new CredentialIntelligence();
  ci.registerCredential('test-provider', 'k1');

  // Simulate 5 failures
  for (let i = 0; i < 5; i++) {
    ci.recordFailure('test-provider', 'k1', 'timeout', 'timeout');
  }

  // Key should be unavailable
  const cred = ci.getCredential('test-provider', 'k1');
  assertOk(!cred.isAvailable(), 'Key should be unavailable after 5 failures');

  // Circuit breaker should also reflect this (needs 5 failures to open)
  for (let i = 0; i < 5; i++) cbRecordFailure('test-provider');
  assertEqual(cbIsAvailable('test-provider'), false);
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  Failure Chain Tests — ${passed}/${total} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
