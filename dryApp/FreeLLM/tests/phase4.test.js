/**
 * Tests Phase 4 — Observability, Chaos Presets, Dashboard Data
 */
const assert = require('assert');

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

console.log('\n🔬 Phase 4 Tests\n');

// ═══ OBSERVABILITY SERVICE ════════════════════════════════════
console.log('Observability Service:');

const { ObservabilityService } = require('../core/services/observability');

test('starts a trace correctly', () => {
  const obs = new ObservabilityService();
  const trace = obs.startTrace('req-001', { taskType: 'code', stream: true });
  assert.strictEqual(trace.requestId, 'req-001');
  assert.strictEqual(trace.taskType, 'code');
  assert.strictEqual(trace.stream, true);
  assert.strictEqual(trace.status, 'pending');
  assert.strictEqual(trace.steps.length, 1);
  assert.strictEqual(trace.steps[0].name, 'start');
});

test('records auth', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-1');
  obs.recordAuth('req-1', true, 'user-123');
  const trace = obs.getTrace('req-1');
  assert.strictEqual(trace.userId, 'user-123');
  assert.strictEqual(trace.steps.length, 2);
  assert.strictEqual(trace.steps[1].name, 'auth');
});

test('records classification', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-2');
  obs.recordClassification('req-2', 'code', 0.85);
  const trace = obs.getTrace('req-2');
  assert.strictEqual(trace.taskType, 'code');
});

test('records routing', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-3');
  obs.recordRouting('req-3', 'google', 'gemini-2.5-pro', 95);
  const trace = obs.getTrace('req-3');
  assert.strictEqual(trace.provider, 'google');
  assert.strictEqual(trace.modelId, 'gemini-2.5-pro');
});

test('records fallback', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-4');
  obs.recordFallback('req-4', 'groq', 'google', 'timeout');
  const trace = obs.getTrace('req-4');
  assert.strictEqual(trace.fallbackCount, 1);
  assert.strictEqual(trace.fallbackHistory.length, 1);
  assert.strictEqual(trace.fallbackHistory[0].from, 'groq');
  assert.strictEqual(trace.fallbackHistory[0].to, 'google');
});

test('records success and finalizes', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-5');
  obs.recordSuccess('req-5', 100, 50, 200);
  const trace = obs.getTrace('req-5');
  assert.strictEqual(trace.status, 'success');
  assert.strictEqual(trace.totalTokens, 150);
  assert.strictEqual(trace.latencyMs, 200);
  assert.strictEqual(obs.getMetrics().totalRequests, 1);
  assert.strictEqual(obs.getMetrics().successRate, '100.0%');
});

test('records error and finalizes', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-6');
  obs.recordError('req-6', 'timeout', 'ETIMEDOUT', 5000);
  const trace = obs.getTrace('req-6');
  assert.strictEqual(trace.status, 'error');
  assert.strictEqual(trace.errorCategory, 'timeout');
  assert.strictEqual(obs.getMetrics().errorRate, '100.0%');
});

test('records cache hit', () => {
  const obs = new ObservabilityService();
  obs.startTrace('req-7');
  obs.recordCacheHit('req-7');
  const trace = obs.getTrace('req-7');
  assert.strictEqual(trace.cacheHit, true);
  assert.strictEqual(trace.status, 'success');
  assert.strictEqual(obs.getMetrics().cacheHitRate, '100.0%');
});

test('aggregates metrics correctly', () => {
  const obs = new ObservabilityService();

  obs.startTrace('r1');
  obs.recordSuccess('r1', 100, 50, 200);

  obs.startTrace('r2');
  obs.recordSuccess('r2', 200, 100, 300);

  obs.startTrace('r3');
  obs.recordError('r3', 'rate_limit', '429', 100);

  const m = obs.getMetrics();
  assert.strictEqual(m.totalRequests, 3);
  assert.strictEqual(m.successRate, '66.7%');
  assert.strictEqual(m.errorRate, '33.3%');
  assert.strictEqual(m.totalTokensUsed, 450);
  assert.ok(m.avgLatencyMs > 0);
});

test('getRecentTraces returns traces in reverse order', () => {
  const obs = new ObservabilityService();
  for (let i = 0; i < 5; i++) {
    obs.startTrace(`r${i}`);
    obs.recordSuccess(`r${i}`, 10, 5, 100);
  }
  const traces = obs.getRecentTraces(3);
  assert.strictEqual(traces.length, 3);
  assert.strictEqual(traces[0].requestId, 'r4'); // most recent first
});

test('getSlowRequests filters correctly', () => {
  const obs = new ObservabilityService();
  obs.startTrace('fast');
  obs.recordSuccess('fast', 10, 5, 100);

  obs.startTrace('slow');
  obs.recordSuccess('slow', 100, 50, 10000);

  const slow = obs.getSlowRequests(5000);
  assert.strictEqual(slow.length, 1);
  assert.strictEqual(slow[0].requestId, 'slow');
});

test('tracks hourly buckets', () => {
  const obs = new ObservabilityService();
  obs.startTrace('r1');
  obs.recordSuccess('r1', 100, 50, 200);

  const m = obs.getMetrics();
  const hourKeys = Object.keys(m.hourly);
  assert.ok(hourKeys.length > 0);
  assert.strictEqual(m.hourly[hourKeys[0]].requests, 1);
});

// ═══ CHAOS PRESETS ═══════════════════════════════════════════
console.log('\nChaos Presets:');

const { ChaosInjector, ChaosScenario } = require('../core/services/chaosTesting');

test('random-timeout preset activates chaos', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN, { probability: 0.3 });
  const status = injector.getStatus();
  assert.strictEqual(status.enabled, true);
  assert.strictEqual(status.active.length, 1);
  assert.strictEqual(status.active[0].provider, 'groq');
});

test('total-outage preset blocks all providers', () => {
  const injector = new ChaosInjector();
  injector.enable();
  const providers = ['groq', 'google', 'openai', 'mistral'];
  for (const p of providers) {
    injector.inject(p, ChaosScenario.PROVIDER_DOWN);
  }

  for (const p of providers) {
    const result = injector.applyChaos(p);
    assert.strictEqual(result.shouldFail, true, `${p} should fail in total outage`);
  }
});

test('cascade-failure preset with different scenarios', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN);
  injector.inject('openai', ChaosScenario.RATE_LIMIT);
  injector.inject('google', ChaosScenario.LATENCY_SPIKE, { latencyMs: 10000 });

  assert.strictEqual(injector.applyChaos('groq').shouldFail, true);
  assert.strictEqual(injector.applyChaos('openai').shouldFail, true);
  const googleResult = injector.applyChaos('google');
  assert.strictEqual(googleResult.shouldFail, false);
  assert.strictEqual(googleResult.delayMs, 10000);
});

// ═══ CAPABILITY REGISTRY INTEGRATION ═════════════════════════
console.log('\nCapability Registry Integration:');

const { initializeRegistry, getCapabilities, hasCapability, findModelsByCapabilities } = require('../core/services/modelCapabilityRegistry');

test('router now uses capability registry for tool filtering', () => {
  initializeRegistry([
    { platform: 'google', modelId: 'gemini-2.5-pro', contextWindow: 1048576 },
    { platform: 'nvidia', modelId: 'llama-3.3-70b', contextWindow: 131072 },
    { platform: 'groq', modelId: 'llama-3.3-70b', contextWindow: 131072 },
  ]);

  // The router now checks capabilityRegistry.getCapabilities() instead of hardcoded TOOLS_SUPPORTED
  const googleCaps = getCapabilities('google', 'gemini-2.5-pro');
  const nvidiaCaps = getCapabilities('nvidia', 'llama-3.3-70b');
  const groqCaps = getCapabilities('groq', 'llama-3.3-70b');

  assert.strictEqual(googleCaps.tool_calling, true);
  assert.strictEqual(nvidiaCaps.tool_calling, false);
  assert.strictEqual(groqCaps.tool_calling, true);
});

test('capability registry handles 16+ platforms', () => {
  const platforms = ['google', 'groq', 'cerebras', 'sambanova', 'nvidia', 'mistral',
    'openrouter', 'github', 'cohere', 'cloudflare', 'zhipu', 'ollama', 'kilo', 'pollinations', 'llm7', 'openai'];

  const models = platforms.map(p => ({ platform: p, modelId: 'test-model', contextWindow: 32768 }));
  initializeRegistry(models);

  for (const p of platforms) {
    const caps = getCapabilities(p, 'test-model');
    assert.ok(caps, `Should have caps for ${p}`);
    assert.strictEqual(caps.text, true, `${p} should support text`);
  }
});

// ═══ DASHBOARD DATA STRUCTURE ════════════════════════════════
console.log('\nDashboard Data Structures:');

test('observability metrics match expected structure', () => {
  const { ObservabilityService } = require('../core/services/observability');
  const obs = new ObservabilityService();

  obs.startTrace('r1', { taskType: 'code', stream: true, isIdeMode: true });
  obs.recordRouting('r1', 'google', 'gemini-2.5-pro', 95);
  obs.recordSuccess('r1', 100, 50, 200);

  const m = obs.getMetrics();
  assert.strictEqual(typeof m.totalRequests, 'number');
  assert.strictEqual(typeof m.successRate, 'string');
  assert.strictEqual(typeof m.avgLatencyMs, 'number');
  assert.strictEqual(typeof m.cacheHitRate, 'string');
  assert.strictEqual(typeof m.byProvider, 'object');
  assert.strictEqual(typeof m.byTaskType, 'object');
  assert.strictEqual(typeof m.errorCategories, 'object');
  assert.strictEqual(typeof m.hourly, 'object');
});

test('trace contains all expected fields', () => {
  const { ObservabilityService } = require('../core/services/observability');
  const obs = new ObservabilityService();

  obs.startTrace('full-trace', {
    userId: 'user-1',
    taskType: 'reasoning',
    stream: false,
    isIdeMode: false,
    degradedMode: false,
  });
  obs.recordAuth('full-trace', true, 'user-1');
  obs.recordClassification('full-trace', 'reasoning', 0.9);
  obs.recordRouting('full-trace', 'openai', 'gpt-4o', 88);
  obs.recordPolicyDecision('full-trace', [{ ruleName: 'health_check', severity: 'info' }]);
  obs.recordSuccess('full-trace', 200, 100, 500);

  const trace = obs.getTrace('full-trace');
  assert.strictEqual(trace.requestId, 'full-trace');
  assert.strictEqual(trace.userId, 'user-1');
  assert.strictEqual(trace.taskType, 'reasoning');
  assert.strictEqual(trace.provider, 'openai');
  assert.strictEqual(trace.modelId, 'gpt-4o');
  assert.strictEqual(trace.totalTokens, 300);
  // Steps: start, auth, classify, route, policy, success = 6
  assert.strictEqual(trace.steps.length, 6);
  assert.ok(trace.createdAt instanceof Date);
});

// ═══ E2E: CHAOS + OBSERVABILITY ══════════════════════════════
console.log('\nE2E: Chaos + Observability Flow:');

test('chaos injection → failure → observability tracks it', () => {
  const injector = new ChaosInjector();
  const obs = new ObservabilityService();

  injector.enable();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN);

  // Simulate request
  const trace = obs.startTrace('chaos-req-1', { taskType: 'chat' });
  obs.recordRouting('chaos-req-1', 'groq', 'llama-3.3-70b', 90);

  // Chaos kicks in
  const chaosResult = injector.applyChaos('groq');
  assert.strictEqual(chaosResult.shouldFail, true);

  // Record the failure
  obs.recordError('chaos-req-1', 'server_error', chaosResult.error.message, 50);

  // Verify observability captured it
  const metrics = obs.getMetrics();
  assert.strictEqual(metrics.totalRequests, 1);
  assert.strictEqual(metrics.errorRate, '100.0%');
  assert.strictEqual(metrics.byProvider.groq.errors, 1);
  assert.strictEqual(metrics.errorCategories.server_error, 1);
});

test('fallback chain → observability tracks each step', () => {
  const obs = new ObservabilityService();
  obs.startTrace('fallback-req', { taskType: 'code' });

  obs.recordRouting('fallback-req', 'groq', 'llama-3.3-70b', 90);
  obs.recordFallback('fallback-req', 'groq', 'google', 'timeout');
  obs.recordRouting('fallback-req', 'google', 'gemini-2.5-pro', 95);
  obs.recordFallback('fallback-req', 'google', 'openai', 'rate_limit');
  obs.recordRouting('fallback-req', 'openai', 'gpt-4o', 85);
  obs.recordSuccess('fallback-req', 100, 50, 800);

  const trace = obs.getTrace('fallback-req');
  assert.strictEqual(trace.fallbackCount, 2);
  assert.strictEqual(trace.fallbackHistory.length, 2);
  assert.strictEqual(trace.fallbackHistory[0].from, 'groq');
  assert.strictEqual(trace.fallbackHistory[0].to, 'google');
  assert.strictEqual(trace.fallbackHistory[1].from, 'google');
  assert.strictEqual(trace.fallbackHistory[1].to, 'openai');
  assert.strictEqual(trace.status, 'success');
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
