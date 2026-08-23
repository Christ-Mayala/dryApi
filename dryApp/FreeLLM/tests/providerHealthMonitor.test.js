/**
 * Tests pour ProviderHealthMonitor
 */
const assert = require('assert');
const { ProviderHealthMonitor } = require('../core/services/providerHealthMonitor');

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

console.log('\n🔍 ProviderHealthMonitor Tests\n');

test('initializes with no providers', () => {
  const monitor = new ProviderHealthMonitor();
  const all = monitor.getAllHealth();
  assert.strictEqual(all.length, 0);
});

test('records success and updates metrics', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('groq', 150, 100, 50);

  const health = monitor.getHealth('groq');
  assert.strictEqual(health.totalRequests, 1);
  assert.strictEqual(health.successCount, 1);
  assert.strictEqual(health.successRate, 1.0);
  assert.strictEqual(health.avgLatencyMs, 150);
});

test('records failure and updates metrics', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordFailure('groq', '429 rate limited', 50);

  const health = monitor.getHealth('groq');
  assert.strictEqual(health.totalRequests, 1);
  assert.strictEqual(health.failureCount, 1);
  assert.strictEqual(health.successRate, 0);
  assert.strictEqual(health.isRateLimited, true);
});

test('calculates success rate correctly', () => {
  const monitor = new ProviderHealthMonitor();

  monitor.recordSuccess('groq', 100);
  monitor.recordSuccess('groq', 150);
  monitor.recordFailure('groq', 'timeout', 200);

  const health = monitor.getHealth('groq');
  assert.strictEqual(health.totalRequests, 3);
  assert.strictEqual(health.successCount, 2);
  assert.strictEqual(health.failureCount, 1);
  assert.ok(Math.abs(health.successRate - 2/3) < 0.001);
});

test('calculates p95 latency', () => {
  const monitor = new ProviderHealthMonitor();

  // Add 20 latencies
  for (let i = 1; i <= 20; i++) {
    monitor.recordSuccess('groq', i * 10); // 10, 20, 30, ..., 200
  }

  const health = monitor.getHealth('groq');
  // p95 of [10,20,...,200] = index 19 = 200
  assert.ok(health.p95LatencyMs > 0);
  assert.ok(health.p95LatencyMs >= health.avgLatencyMs);
});

test('clears rate limit on success', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordFailure('groq', '429 rate limited');
  assert.strictEqual(monitor.getHealth('groq').isRateLimited, true);

  monitor.recordSuccess('groq', 100);
  assert.strictEqual(monitor.getHealth('groq').isRateLimited, false);
});

test('getHealthScore returns 0-100', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('groq', 100);
  const score = monitor.getHealthScore('groq');
  assert.ok(score >= 0 && score <= 100, `Score ${score} out of range`);
});

test('getHealthScore penalizes high latency', () => {
  const monitorFast = new ProviderHealthMonitor();
  const monitorSlow = new ProviderHealthMonitor();

  monitorFast.recordSuccess('fast', 50);
  monitorSlow.recordSuccess('slow', 5000);

  const scoreFast = monitorFast.getHealthScore('fast');
  const scoreSlow = monitorSlow.getHealthScore('slow');
  assert.ok(scoreFast > scoreSlow, `Fast ${scoreFast} should be > slow ${scoreSlow}`);
});

test('getHealthScore penalizes rate limiting', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('groq', 100);
  const scoreBefore = monitor.getHealthScore('groq');

  monitor.recordFailure('groq', '429 rate limited');
  const scoreAfter = monitor.getHealthScore('groq');
  assert.ok(scoreAfter < scoreBefore, `Score should decrease after rate limit`);
});

test('getRankedProviders excludes rate-limited', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('groq', 100);
  monitor.recordSuccess('google', 100);
  monitor.recordFailure('mistral', '429 rate limited');

  const ranked = monitor.getRankedProviders();
  assert.ok(!ranked.some(p => p.provider === 'mistral'));
  assert.ok(ranked.some(p => p.provider === 'groq'));
});

test('getAllHealth returns all providers', () => {
  const monitor = new ProviderHealthMonitor();
  monitor.recordSuccess('groq', 100);
  monitor.recordSuccess('google', 150);

  const all = monitor.getAllHealth();
  assert.strictEqual(all.length, 2);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
