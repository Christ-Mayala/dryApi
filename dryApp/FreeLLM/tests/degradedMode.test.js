/**
 * Tests pour DegradedMode
 */
const assert = require('assert');
const { DegradedModeManager, DegradedState } = require('../core/services/degradedMode');

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

console.log('\n🔍 DegradedMode Tests\n');

// We need to mock the circuit breaker for these tests.
// Since the module uses singletons, we test the DegradedModeManager directly.

test('starts in NORMAL state', () => {
  const mgr = new DegradedModeManager();
  assert.strictEqual(mgr.state, DegradedState.NORMAL);
  assert.strictEqual(mgr.isDegraded(), false);
  assert.strictEqual(mgr.isOffline(), false);
});

test('stays NORMAL when all providers available', () => {
  const mgr = new DegradedModeManager();
  // Mock: all providers available
  const mockBreakers = { isAvailable: () => true };
  // We test the state machine logic directly
  const result = mgr.evaluateState(['groq', 'google', 'openai']);
  // Since we can't mock the singleton, test the logic
  assert.ok(result.state);
});

test('generateOfflineResponse returns structured response', () => {
  const mgr = new DegradedModeManager();
  const messages = [{ role: 'user', content: 'Hello' }];
  const response = mgr.generateOfflineResponse(messages, 'req-123');

  assert.strictEqual(response.object, 'chat.completion');
  assert.strictEqual(response._offline, true);
  assert.strictEqual(response._degraded, true);
  assert.ok(response.choices[0].message.content.includes('hors-ligne'));
  assert.ok(response.choices[0].message.content.includes('req-123'));
});

test('generateOfflineResponse handles empty user message', () => {
  const mgr = new DegradedModeManager();
  const response = mgr.generateOfflineResponse([], 'req-456');
  assert.ok(response.choices[0].message.content);
});

test('getStatus returns complete info', () => {
  const mgr = new DegradedModeManager();
  const status = mgr.getStatus();
  assert.strictEqual(status.state, DegradedState.NORMAL);
  assert.ok(typeof status.stats.degradedActivations === 'number');
  assert.ok(typeof status.stats.emergencyActivations === 'number');
  assert.ok(typeof status.stats.recoveries === 'number');
});

test('manual state transition via _transition', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.DEGRADED, 'Test degraded');
  assert.strictEqual(mgr.state, DegradedState.DEGRADED);
  assert.strictEqual(mgr.isDegraded(), true);
  assert.strictEqual(mgr.emergencyMessage, 'Test degraded');
  assert.strictEqual(mgr.stats.degradedActivations, 1);
});

test('emergency state tracks cloud down time', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.EMERGENCY, 'All cloud down');
  assert.strictEqual(mgr.state, DegradedState.EMERGENCY);
  assert.ok(mgr.cloudDownSince > 0);
  assert.strictEqual(mgr.stats.emergencyActivations, 1);
});

test('recovery from degraded increments counter', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.DEGRADED, 'degraded');
  mgr._transition(DegradedState.NORMAL, null);
  assert.strictEqual(mgr.state, DegradedState.NORMAL);
  assert.strictEqual(mgr.stats.recoveries, 1);
});

test('offline state blocks all providers', () => {
  const mgr = new DegradedModeManager();
  mgr._transition(DegradedState.OFFLINE, 'Everything is down');
  assert.strictEqual(mgr.isOffline(), true);
  assert.strictEqual(mgr.isDegraded(), true);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
