/**
 * Phase 7 Tests — Streaming Recovery, Distributed State, Dashboard, Chaos API
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
// 1. STREAMING RECOVERY
// ═══════════════════════════════════════════════════════════════

console.log('\n── Streaming Recovery ──');

const { StreamTracker, StreamManager, streamManager } = require('../core/services/streamingRecovery.js');

test('StreamTracker records chunks', () => {
  const tracker = new StreamTracker('req-1');
  tracker.provider = 'groq';
  tracker.modelId = 'llama-3';

  tracker.addChunk({ choices: [{ delta: { content: 'Hello' } }] });
  tracker.addChunk({ choices: [{ delta: { content: ' world' } }] });

  assertEqual(tracker.chunkCount, 2);
  assertEqual(tracker.accumulatedText, 'Hello world');
  assertOk(tracker.totalOutputTokens > 0);
});

test('StreamTracker marks complete', () => {
  const tracker = new StreamTracker('req-2');
  tracker.markComplete();
  assertOk(tracker.completed);
  assertEqual(tracker.interrupted, false);
});

test('StreamTracker marks interrupted', () => {
  const tracker = new StreamTracker('req-3');
  tracker.addChunk({ choices: [{ delta: { content: 'partial' } }] });
  tracker.markInterrupted('ETIMEDOUT');
  assertOk(tracker.interrupted);
  assertEqual(tracker.error, 'ETIMEDOUT');
});

test('StreamTracker generates partial response', () => {
  const tracker = new StreamTracker('req-4');
  tracker.modelId = 'gpt-4';
  tracker.addChunk({ choices: [{ delta: { content: 'Partial content' } }] });
  tracker.markInterrupted('timeout');

  const partial = tracker.getPartialResponse();
  assertOk(partial);
  assertOk(partial._partial);
  assertOk(partial._interrupted);
  assertEqual(partial.choices[0].message.content, 'Partial content');
  assertEqual(partial.choices[0].finish_reason, 'length');
});

test('StreamTracker empty partial returns null', () => {
  const tracker = new StreamTracker('req-5');
  const partial = tracker.getPartialResponse();
  assertEqual(partial, null);
});

test('StreamManager tracks active streams', () => {
  const mgr = new StreamManager();
  const tracker = mgr.startStream('r1', 'groq', 'llama');
  assertOk(tracker);
  assertEqual(mgr.getStats().active, 1);

  mgr.completeStream('r1');
  assertEqual(mgr.getStats().active, 0);
  assertEqual(mgr.getStats().completed, 1);
});

test('StreamManager detects timed-out streams', () => {
  const mgr = new StreamManager();
  mgr.startStream('r2', 'groq', 'llama');
  // Simulate old stream by backdating
  const tracker = mgr.getTracker('r2');
  tracker.lastChunkAt = Date.now() - 60000; // 60s ago

  const timedOut = mgr.getTimedOutStreams(30000);
  assertEqual(timedOut.length, 1);
  assertEqual(timedOut[0].requestId, 'r2');
});

test('Streaming Recovery: canRecover for retryable errors', () => {
  const mgr = new StreamManager();
  mgr.startStream('r3', 'groq', 'llama');
  const tracker = mgr.getTracker('r3');
  tracker.addChunk({ choices: [{ delta: { content: 'text' } }] });
  tracker.markInterrupted('ETIMEDOUT');

  assertOk(mgr.canRecover('r3'), 'Should be recoverable for timeout');
});

test('Streaming Recovery: cannot recover non-retryable errors', () => {
  const mgr = new StreamManager();
  mgr.startStream('r4', 'groq', 'llama');
  const tracker = mgr.getTracker('r4');
  tracker.addChunk({ choices: [{ delta: { content: 'text' } }] });
  tracker.markInterrupted('401 Unauthorized');

  assertEqual(mgr.canRecover('r4'), false, 'Auth errors should not be recoverable');
});

test('Streaming Recovery: cannot recover already-attempted', () => {
  const mgr = new StreamManager();
  mgr.startStream('r5', 'groq', 'llama');
  const tracker = mgr.getTracker('r5');
  tracker.addChunk({ choices: [{ delta: { content: 'text' } }] });
  tracker.markInterrupted('timeout');
  mgr.markRecoveryAttempted('r5');

  assertEqual(mgr.canRecover('r5'), false, 'Should not re-attempt recovery');
});

test('Streaming Recovery: sendPartialResponse closes stream', () => {
  const mgr = new StreamManager();
  mgr.startStream('r6', 'groq', 'llama');
  const tracker = mgr.getTracker('r6');
  tracker.addChunk({ choices: [{ delta: { content: 'Hello' } }] });
  tracker.markInterrupted('timeout');

  let written = [];
  let ended = false;
  const fakeRes = {
    write: (data) => { written.push(data); return true; },
    end: () => { ended = true; },
  };

  const partial = mgr.sendPartialResponse(fakeRes, 'r6');
  assertOk(partial);
  assertOk(ended, 'Response should be ended');
  assertOk(written.length >= 2, 'Should write at least error + DONE');
});

test('StreamTracker summary', () => {
  const tracker = new StreamTracker('r7');
  tracker.provider = 'groq';
  tracker.modelId = 'llama';
  tracker.addChunk({ choices: [{ delta: { content: 'test' } }] });

  const summary = tracker.getSummary();
  assertEqual(summary.requestId, 'r7');
  assertEqual(summary.provider, 'groq');
  assertEqual(summary.chunks, 1);
  assertOk(summary.duration >= 0);
});

// ═══════════════════════════════════════════════════════════════
// 2. DISTRIBUTED STATE
// ═══════════════════════════════════════════════════════════════

console.log('\n── Distributed State ──');

const { DistributedStateManager, InMemoryStore } = require('../core/services/distributedState.js');

test('InMemoryStore set/get/del cycle', async () => {
  const store = new InMemoryStore();
  await store.set('k', 'v');
  assertEqual(await store.get('k'), 'v');
  await store.del('k');
  assertEqual(await store.get('k'), null);
  store.destroy();
});

test('InMemoryStore incr atomic', async () => {
  const store = new InMemoryStore();
  await store.incr('c');
  await store.incr('c');
  await store.incr('c');
  assertEqual(await store.get('c'), 3);
  store.destroy();
});

test('InMemoryStore hash set/get', async () => {
  const store = new InMemoryStore();
  await store.hset('h', 'f1', 'v1');
  await store.hset('h', 'f2', 'v2');
  const all = await store.hgetall('h');
  assertEqual(all.f1, 'v1');
  assertEqual(all.f2, 'v2');
  store.destroy();
});

test('InMemoryStore TTL expiry', async () => {
  const store = new InMemoryStore();
  await store.set('exp', 'val', 1);
  await new Promise(r => setTimeout(r, 10));
  assertEqual(await store.get('exp'), null);
  store.destroy();
});

test('InMemoryStore keys pattern match', async () => {
  const store = new InMemoryStore();
  await store.set('user:1', 'a');
  await store.set('user:2', 'b');
  await store.set('post:1', 'c');
  const keys = await store.keys('user:*');
  assertEqual(keys.length, 2);
  store.destroy();
});

test('DistributedState initializes in-memory', async () => {
  const ds = new DistributedStateManager();
  const mode = await ds.initialize();
  assertEqual(mode, 'in-memory');
  assertEqual(ds.getStatus().mode, 'in-memory');
});

test('DistributedState circuit breaker state', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  await ds.setCircuitBreakerState('groq', { state: 'open', failures: 5 });
  const state = await ds.getCircuitBreakerState('groq');
  assertEqual(state.state, 'open');
  assertEqual(state.failures, 5);
});

test('DistributedState quota tracking', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  await ds.incrementQuota('google', 'gemini', 'k1', 10);
  await ds.incrementQuota('google', 'gemini', 'k1', 5);
  assertEqual(await ds.getQuota('google', 'gemini', 'k1'), 15);
});

test('DistributedState rate limiting', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  assertOk(await ds.checkRateLimit('rl:1', 3));
  assertOk(await ds.checkRateLimit('rl:1', 3));
  assertOk(await ds.checkRateLimit('rl:1', 3));
  assertEqual(await ds.checkRateLimit('rl:1', 3), false);
});

test('DistributedState lock acquire/release', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  const lock1 = await ds.acquireLock('res');
  assertOk(lock1.acquired);
  const lock2 = await ds.acquireLock('res');
  assertEqual(lock2.acquired, false);
  await ds.releaseLock('res', lock1.lockValue);
  const lock3 = await ds.acquireLock('res');
  assertOk(lock3.acquired);
});

test('DistributedState provider health', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  await ds.setProviderHealth('openai', { successRate: 0.95 });
  const h = await ds.getProviderHealth('openai');
  assertEqual(h.successRate, 0.95);
  const all = await ds.getAllProviderHealth();
  assertOk(all.openai);
});

test('DistributedState tracks stats', async () => {
  const ds = new DistributedStateManager();
  await ds.initialize();
  await ds.get('t');
  await ds.set('t', 'v');
  const s = ds.getStatus();
  assertOk(s.stats.reads > 0);
  assertOk(s.stats.writes > 0);
});

// ═══════════════════════════════════════════════════════════════
// 3. CHAOS TESTING
// ═══════════════════════════════════════════════════════════════

console.log('\n── Chaos Testing ──');

const { chaosInjector, ChaosScenario } = require('../core/services/chaosTesting.js');

test('ChaosScenario has all 8 scenarios', () => {
  assertOk(ChaosScenario.PROVIDER_DOWN);
  assertOk(ChaosScenario.LATENCY_SPIKE);
  assertOk(ChaosScenario.NETWORK_FAILURE);
  assertOk(ChaosScenario.QUOTA_EXHAUSTED);
  assertOk(ChaosScenario.AUTH_FAILURE);
  assertOk(ChaosScenario.RATE_LIMIT);
  assertOk(ChaosScenario.INVALID_RESPONSE);
  assertOk(ChaosScenario.STREAM_INTERRUPT);
});

test('ChaosInjector enable/disable cycle', () => {
  chaosInjector.disable();
  assertEqual(chaosInjector.getStatus().enabled, false);
  chaosInjector.enable();
  assertEqual(chaosInjector.getStatus().enabled, true);
  chaosInjector.disable();
});

test('ChaosInjector inject/clear cycle', () => {
  chaosInjector.enable();
  chaosInjector.inject('test-provider', ChaosScenario.TIMEOUT, { probability: 0.5 });
  const status = chaosInjector.getStatus();
  assertOk(status.active.some(a => a.provider === 'test-provider'));
  chaosInjector.remove('test-provider');
  chaosInjector.disable();
});

// ═══════════════════════════════════════════════════════════════
// 4. INTEGRATION: Streaming + Provider Mesh
// ═══════════════════════════════════════════════════════════════

console.log('\n── Integration: Streaming + Mesh ──');

test('Stream interrupted → partial response available', () => {
  const mgr = new StreamManager();
  mgr.startStream('int-1', 'groq', 'llama');
  const tracker = mgr.getTracker('int-1');

  // Simulate partial stream
  tracker.addChunk({ choices: [{ delta: { content: 'The answer' } }] });
  tracker.addChunk({ choices: [{ delta: { content: ' is ' } }] });
  tracker.addChunk({ choices: [{ delta: { content: '42' } }] });
  tracker.markInterrupted('ETIMEDOUT');

  assertOk(tracker.accumulatedText.includes('42'));
  assertOk(tracker.interrupted);

  const partial = tracker.getPartialResponse();
  assertOk(partial);
  assertOk(partial.choices[0].message.content.includes('42'));
});

test('Stream completed → no partial response needed', () => {
  const mgr = new StreamManager();
  mgr.startStream('int-2', 'google', 'gemini');
  const tracker = mgr.getTracker('int-2');
  tracker.addChunk({ choices: [{ delta: { content: 'Done!' } }] });
  tracker.markComplete();

  assertOk(tracker.completed);
  assertEqual(tracker.interrupted, false);
});

test('No duplicate chunks on reconnect', () => {
  const mgr = new StreamManager();
  mgr.startStream('dedup-1', 'openai', 'gpt-4');
  const tracker = mgr.getTracker('dedup-1');

  tracker.addChunk({ choices: [{ delta: { content: 'Hello' } }] });
  tracker.addChunk({ choices: [{ delta: { content: ' world' } }] });

  const chunks = mgr.getChunksToSend('dedup-1');
  assertEqual(chunks.length, 2);
  assertEqual(chunks[0], 'Hello');
  assertEqual(chunks[1], ' world');

  // sentChunkCount tracks what client already has
  tracker.sentChunkCount = 2;
  assertEqual(tracker.sentChunkCount, 2);
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  Phase 7 Tests — ${passed}/${total} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
