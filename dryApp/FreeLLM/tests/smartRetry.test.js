/**
 * Tests pour SmartRetry
 */
const assert = require('assert');
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

console.log('\n🔍 SmartRetry Tests\n');

// --- RetryState ---
console.log('RetryState:');

test('initializes with correct defaults', () => {
  const state = new RetryState();
  assert.strictEqual(state.totalAttempts, 0);
  assert.strictEqual(state.fallbackCount, 0);
  assert.strictEqual(state.shouldContinue(), true);
});

test('records timeout as retry_same_provider', () => {
  const state = new RetryState({ maxNetworkRetries: 2 });
  const decision = state.recordAttempt(new Error('ETIMEDOUT'), 'groq', 'key1');
  assert.strictEqual(decision.action, 'retry_same_provider');
  assert.strictEqual(decision.classifiedError.category, 'timeout');
  assert.ok(decision.delayMs >= 0);
});

test('records 429 as fallback', () => {
  const state = new RetryState({ maxRetries: 3 });
  const decision = state.recordAttempt(new Error('429 rate limit'), 'groq', 'key1');
  assert.strictEqual(decision.action, 'fallback');
  assert.strictEqual(decision.classifiedError.category, 'rate_limit');
});

test('records 401 as fail (non-retryable)', () => {
  const state = new RetryState();
  const decision = state.recordAttempt(new Error('401 Unauthorized'), 'openai', 'key1');
  assert.strictEqual(decision.action, 'fail');
  assert.strictEqual(decision.classifiedError.category, 'auth_error');
  assert.strictEqual(state.shouldContinue(), false);
});

test('records 400 as fail (non-retryable)', () => {
  const state = new RetryState();
  const decision = state.recordAttempt(new Error('400 Bad Request'), 'google', 'key1');
  assert.strictEqual(decision.action, 'fail');
});

test('network error retries same provider up to limit', () => {
  const state = new RetryState({ maxNetworkRetries: 2 });

  const d1 = state.recordAttempt(new Error('ECONNREFUSED'), 'groq', 'key1');
  assert.strictEqual(d1.action, 'retry_same_provider');
  assert.strictEqual(state.networkRetries, 1);

  const d2 = state.recordAttempt(new Error('ECONNREFUSED'), 'groq', 'key1');
  assert.strictEqual(d2.action, 'retry_same_provider');
  assert.strictEqual(state.networkRetries, 2);

  // Third network error → network budget exhausted, falls back or fails
  const d3 = state.recordAttempt(new Error('ECONNREFUSED'), 'groq', 'key1');
  assert.ok(d3.action === 'fallback' || d3.action === 'fail', `Expected fallback or fail, got ${d3.action}`);
});

test('stops after maxRetries fallbacks', () => {
  const state = new RetryState({ maxRetries: 2 });

  state.recordAttempt(new Error('429'), 'p1', 'k1');
  assert.strictEqual(state.fallbackCount, 1);
  assert.strictEqual(state.shouldContinue(), true);

  state.recordAttempt(new Error('429'), 'p2', 'k2');
  assert.strictEqual(state.fallbackCount, 2);
  // Budget exhausted → shouldContinue returns false
  assert.strictEqual(state.shouldContinue(), false);

  // Third 429 → returns fail (not fallback)
  const d3 = state.recordAttempt(new Error('429'), 'p3', 'k3');
  assert.strictEqual(d3.action, 'fail');
  assert.strictEqual(state.shouldContinue(), false);
});

test('tracks blacklisted keys', () => {
  const state = new RetryState();
  state.recordAttempt(new Error('401'), 'openai', 'key_bad');
  state.recordAttempt(new Error('timeout'), 'groq', 'key_ok');

  const blacklisted = state.getBlacklistedKeys();
  assert.ok(blacklisted.includes('key_bad'));
  assert.ok(!blacklisted.includes('key_ok'));
});

test('calculates exponential backoff delays', () => {
  const state = new RetryState({ baseDelayMs: 100, jitterFactor: 0 });

  state.recordAttempt(new Error('429'), 'groq', 'key1');
  const d1 = state.calculateDelay(state.errors[0]);
  assert.ok(d1 >= 100, `Expected >= 100, got ${d1}`);

  state.recordAttempt(new Error('429'), 'groq', 'key2');
  const d2 = state.calculateDelay(state.errors[1]);
  assert.ok(d2 >= 200, `Expected >= 200, got ${d2}`);
});

test('uses Retry-After from provider when available', () => {
  const state = new RetryState({ maxDelayMs: 120000 });
  state.recordAttempt(new Error('429 retry after 60s'), 'groq', 'key1');
  const delay = state.calculateDelay(state.errors[0]);
  assert.strictEqual(delay, 60000);
});

test('caps delay at maxDelayMs', () => {
  const state = new RetryState({ maxDelayMs: 5000 });
  state.recordAttempt(new Error('429 retry after 30s'), 'groq', 'key1');
  const delay = state.calculateDelay(state.errors[0]);
  assert.ok(delay <= 5000, `Expected <= 5000, got ${delay}`);
});

test('getSummary returns complete state', () => {
  const state = new RetryState();
  state.recordAttempt(new Error('timeout'), 'groq', 'key1');
  const summary = state.getSummary();
  assert.strictEqual(summary.totalAttempts, 1);
  assert.ok(summary.elapsedMs >= 0);
  assert.ok(Array.isArray(summary.errors));
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
