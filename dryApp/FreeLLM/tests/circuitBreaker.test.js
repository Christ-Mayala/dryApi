/**
 * Tests pour CircuitBreakerV2
 */
const assert = require('assert');
const { CircuitBreaker: ProviderCircuitBreaker, CircuitBreakerManager, CIRCUIT_STATES: CircuitState } = require('../core/services/circuitBreaker');

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

console.log('\n🔍 CircuitBreakerV2 Tests\n');

// --- ProviderCircuitBreaker ---
console.log('ProviderCircuitBreaker:');

test('starts in CLOSED state', () => {
  const cb = new ProviderCircuitBreaker('test-provider');
  assert.strictEqual(cb.state, CircuitState.CLOSED);
  assert.strictEqual(cb.canCall(), true);
});

test('opens after failure threshold', () => {
  const cb = new ProviderCircuitBreaker('test', { failureThreshold: 3 });

  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.CLOSED);

  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.CLOSED);

  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.OPEN);
  assert.strictEqual(cb.canCall(), false);
});

test('transitions to HALF_OPEN after recovery timeout', (done) => {
  const cb = new ProviderCircuitBreaker('test', {
    failureThreshold: 2,
    recoveryTimeoutMs: 50,
  });

  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.OPEN);

  setTimeout(() => {
    assert.strictEqual(cb.canCall(), true);
    assert.strictEqual(cb.state, CircuitState.HALF_OPEN);
    done();
  }, 60);
});

test('closes after successful half-open probe', () => {
  const cb = new ProviderCircuitBreaker('test', {
    failureThreshold: 2,
    recoveryTimeoutMs: 0, // instant
    successThreshold: 1,
  });

  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.OPEN);

  // Trigger half-open
  cb.canCall();
  assert.strictEqual(cb.state, CircuitState.HALF_OPEN);

  cb.recordSuccess();
  assert.strictEqual(cb.state, CircuitState.CLOSED);
});

test('re-opens on half-open failure', () => {
  const cb = new ProviderCircuitBreaker('test', {
    failureThreshold: 2,
    recoveryTimeoutMs: 0,
  });

  cb.recordFailure();
  cb.recordFailure();
  cb.canCall(); // → HALF_OPEN
  assert.strictEqual(cb.state, CircuitState.HALF_OPEN);

  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.OPEN);
});

test('resets failure count on success in CLOSED', () => {
  const cb = new ProviderCircuitBreaker('test', { failureThreshold: 5 });

  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.failureCount, 2);

  cb.recordSuccess();
  assert.strictEqual(cb.failureCount, 1);
});

test('exponential backoff increases recovery timeout', (done) => {
  const cb = new ProviderCircuitBreaker('test', {
    failureThreshold: 1,
    recoveryTimeoutMs: 30, // short for testing
    maxRecoveryTimeoutMs: 10000,
  });

  cb.recordFailure(); // opens at 1 → doubles to 60
  assert.strictEqual(cb.currentRecoveryTimeout, 60);
  assert.strictEqual(cb.openCount, 1);

  // Wait for recovery timeout to elapse
  setTimeout(() => {
    assert.strictEqual(cb.canCall(), true); // → HALF_OPEN
    assert.strictEqual(cb.state, CircuitState.HALF_OPEN);

    cb.recordFailure(); // → OPEN again → doubles from 60 to 120
    assert.strictEqual(cb.currentRecoveryTimeout, 120);
    assert.strictEqual(cb.openCount, 2);
    done();
  }, 35);
});

test('reset() returns to CLOSED', () => {
  const cb = new ProviderCircuitBreaker('test', { failureThreshold: 1 });

  cb.recordFailure();
  assert.strictEqual(cb.state, CircuitState.OPEN);

  cb.reset();
  assert.strictEqual(cb.state, CircuitState.CLOSED);
  assert.strictEqual(cb.failureCount, 0);
});

test('getStatus returns complete info', () => {
  const cb = new ProviderCircuitBreaker('my-provider');
  cb.recordFailure();

  const status = cb.getStatus();
  assert.strictEqual(status.provider, 'my-provider');
  assert.strictEqual(status.state, CircuitState.CLOSED);
  assert.strictEqual(status.failureCount, 1);
  assert.ok(typeof status.timeToRecovery === 'number');
});

// --- CircuitBreakerManager ---
console.log('\nCircuitBreakerManager:');

test('creates breakers on demand', () => {
  const mgr = new CircuitBreakerManager();
  const cb = mgr.getBreaker('groq');
  assert.ok(cb instanceof ProviderCircuitBreaker);
  assert.strictEqual(cb.key, 'groq');
});

test('isAvailable returns true for new provider', () => {
  const mgr = new CircuitBreakerManager();
  assert.strictEqual(mgr.isAvailable('google'), true);
});

test('isAvailable returns false when circuit is open', () => {
  const mgr = new CircuitBreakerManager();
  mgr.setProviderOptions('test', { failureThreshold: 1, recoveryTimeoutMs: 60000 });

  mgr.recordFailure('test');
  assert.strictEqual(mgr.isAvailable('test'), false);
});

test('recordSuccess and recordFailure work', () => {
  const mgr = new CircuitBreakerManager();
  mgr.recordSuccess('groq');
  mgr.recordFailure('groq');
  // No error = pass
});

test('resetAll resets all breakers', () => {
  const mgr = new CircuitBreakerManager();
  mgr.setProviderOptions('a', { failureThreshold: 1 });
  mgr.setProviderOptions('b', { failureThreshold: 1 });

  mgr.recordFailure('a');
  mgr.recordFailure('b');

  mgr.resetAll();

  assert.strictEqual(mgr.isAvailable('a'), true);
  assert.strictEqual(mgr.isAvailable('b'), true);
});

test('getAllStatus returns sorted results', () => {
  const mgr = new CircuitBreakerManager();
  mgr.setProviderOptions('open-provider', { failureThreshold: 1 });
  mgr.recordFailure('open-provider');

  mgr.recordSuccess('closed-provider');

  const all = mgr.getAllStatus();
  assert.ok(all.length >= 2);
  // Open should be first
  assert.strictEqual(all[0].state, CircuitState.OPEN);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
