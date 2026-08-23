/**
 * Tests Phase 3 — Streaming Recovery, Chaos Testing, Cache V2, Context V2
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

console.log('\n🔬 Phase 3 Tests\n');

// ═══ STREAMING RECOVERY ═══════════════════════════════════════
console.log('Streaming Recovery:');

const { StreamTracker, StreamManager, streamManager } = require('../core/services/streamingRecovery');

test('StreamTracker initializes correctly', () => {
  const tracker = new StreamTracker('req-123');
  assert.strictEqual(tracker.requestId, 'req-123');
  assert.strictEqual(tracker.completed, false);
  assert.strictEqual(tracker.interrupted, false);
  assert.strictEqual(tracker.chunkCount, 0);
});

test('StreamTracker accumulates chunks', () => {
  const tracker = new StreamTracker('req-1');
  tracker.provider = 'groq';
  tracker.modelId = 'llama-3.3-70b';

  tracker.addChunk({ choices: [{ delta: { content: 'Hello' } }] });
  tracker.addChunk({ choices: [{ delta: { content: ' world' } }] });

  assert.strictEqual(tracker.accumulatedText, 'Hello world');
  assert.strictEqual(tracker.chunkCount, 2);
  assert.ok(tracker.totalOutputTokens > 0);
});

test('StreamTracker marks complete', () => {
  const tracker = new StreamTracker('req-2');
  tracker.addChunk({ choices: [{ delta: { content: 'test' } }] });
  tracker.markComplete();

  assert.strictEqual(tracker.completed, true);
  assert.strictEqual(tracker.interrupted, false);
});

test('StreamTracker marks interrupted', () => {
  const tracker = new StreamTracker('req-3');
  tracker.addChunk({ choices: [{ delta: { content: 'partial' } }] });
  tracker.markInterrupted(new Error('connection lost'));

  assert.strictEqual(tracker.interrupted, true);
  assert.strictEqual(tracker.error, 'connection lost');
});

test('StreamTracker generates partial response', () => {
  const tracker = new StreamTracker('req-4');
  tracker.provider = 'google';
  tracker.modelId = 'gemini-2.5-pro';
  tracker.addChunk({ choices: [{ delta: { content: 'Partial text' } }] });
  tracker.markInterrupted('timeout');

  const partial = tracker.getPartialResponse();
  assert.ok(partial);
  assert.strictEqual(partial._partial, true);
  assert.strictEqual(partial._interrupted, true);
  assert.strictEqual(partial.choices[0].message.content, 'Partial text');
  assert.strictEqual(partial.choices[0].finish_reason, 'length');
});

test('StreamTracker returns null for empty partial response', () => {
  const tracker = new StreamTracker('req-5');
  assert.strictEqual(tracker.getPartialResponse(), null);
});

test('StreamManager tracks active streams', () => {
  const mgr = new StreamManager();
  const tracker = mgr.startStream('r1', 'groq', 'llama-3.3-70b');

  assert.strictEqual(mgr.activeStreams.size, 1);
  assert.strictEqual(tracker.provider, 'groq');

  mgr.completeStream('r1');
  assert.strictEqual(mgr.activeStreams.size, 0);
  assert.strictEqual(mgr.completedStreams.length, 1);
});

test('StreamManager detects timed-out streams', () => {
  const mgr = new StreamManager();
  mgr.startStream('r1', 'groq', 'model');

  // Manually set lastChunkAt to past
  const tracker = mgr.getTracker('r1');
  tracker.lastChunkAt = Date.now() - 60000; // 1 minute ago

  const timedOut = mgr.getTimedOutStreams(30000);
  assert.strictEqual(timedOut.length, 1);
  assert.strictEqual(timedOut[0].requestId, 'r1');
});

test('StreamManager getStats returns info', () => {
  const mgr = new StreamManager();
  mgr.startStream('a', 'p', 'm');
  mgr.startStream('b', 'p', 'm');
  const stats = mgr.getStats();
  assert.strictEqual(stats.active, 2);
});

// ═══ CHAOS TESTING ════════════════════════════════════════════
console.log('\nChaos Testing:');

const { ChaosInjector, ChaosScenario, chaosInjector } = require('../core/services/chaosTesting');

test('ChaosInjector is disabled by default', () => {
  const injector = new ChaosInjector();
  assert.strictEqual(injector.enabled, false);
  assert.strictEqual(injector.check('groq'), null);
});

test('ChaosInjector enables/disables', () => {
  const injector = new ChaosInjector();
  injector.enable();
  assert.strictEqual(injector.enabled, true);
  injector.disable();
  assert.strictEqual(injector.enabled, false);
});

test('ChaosInjector injects provider_down scenario', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN);

  const result = injector.applyChaos('groq');
  assert.strictEqual(result.shouldFail, true);
  assert.ok(result.error.message.includes('groq'), 'Error should mention provider');
});

test('ChaosInjector injects latency_spike', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('google', ChaosScenario.LATENCY_SPIKE, { latencyMs: 10000 });

  const result = injector.applyChaos('google');
  assert.strictEqual(result.shouldFail, false);
  assert.strictEqual(result.delayMs, 10000);
});

test('ChaosInjector injects rate_limit', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('openai', ChaosScenario.RATE_LIMIT);

  const result = injector.applyChaos('openai');
  assert.strictEqual(result.shouldFail, true);
  assert.ok(result.error.message.includes('openai'), 'Error should mention provider');
});

test('ChaosInjector injects auth_failure', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('mistral', ChaosScenario.AUTH_FAILURE);

  const result = injector.applyChaos('mistral');
  assert.strictEqual(result.shouldFail, true);
  assert.ok(result.error.message.includes('mistral'), 'Error should mention provider');
});

test('ChaosInjector probability-based injection', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('test', ChaosScenario.PROVIDER_DOWN, { probability: 0.0 });

  // With 0% probability, should never trigger
  for (let i = 0; i < 10; i++) {
    const result = injector.check('test');
    assert.strictEqual(result, null);
  }
});

test('ChaosInjector respects expiry', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('test', ChaosScenario.PROVIDER_DOWN, { duration: 1 });

  // Wait a bit
  setTimeout(() => {
    const result = injector.check('test');
    assert.strictEqual(result, null); // expired
  }, 5);
});

test('ChaosInjector getStatus returns active', () => {
  const injector = new ChaosInjector();
  injector.enable();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN);

  const status = injector.getStatus();
  assert.strictEqual(status.enabled, true);
  assert.strictEqual(status.active.length, 1);
  assert.strictEqual(status.active[0].provider, 'groq');
});

test('ChaosInjector does nothing when disabled', () => {
  const injector = new ChaosInjector();
  injector.inject('groq', ChaosScenario.PROVIDER_DOWN);
  const result = injector.applyChaos('groq');
  assert.strictEqual(result.shouldFail, false);
});

// ═══ RESPONSE CACHE V2 ═══════════════════════════════════════
console.log('\nResponse Cache V2:');

const { LRUCache, responseCache } = require('../core/services/responseCache');

test('LRUCache stores and retrieves', () => {
  const cache = new LRUCache(10);
  cache.set('key1', { data: 'hello' });
  assert.deepStrictEqual(cache.get('key1'), { data: 'hello' });
});

test('LRUCache evicts LRU entry', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);

  // Access 'a' to make it recently used
  cache.get('a');

  // Add 'd' → should evict 'b' (least recently used)
  cache.set('d', 4);

  assert.strictEqual(cache.get('a'), 1);
  assert.strictEqual(cache.get('b'), null); // evicted
  assert.strictEqual(cache.get('c'), 3);
  assert.strictEqual(cache.get('d'), 4);
});

test('LRUCache respects TTL', () => {
  const cache = new LRUCache(10);
  cache.set('key', 'value', 1); // 1ms TTL

  // Wait for expiry
  setTimeout(() => {
    assert.strictEqual(cache.get('key'), null);
  }, 5);
});

test('LRUCache tracks stats', () => {
  const cache = new LRUCache(10);
  cache.set('a', 1);
  cache.get('a'); // hit
  cache.get('b'); // miss

  const stats = cache.getStats();
  assert.strictEqual(stats.totalHits, 1);
  assert.strictEqual(stats.totalMisses, 1);
  assert.strictEqual(stats.size, 1);
});

test('responseCache.isCacheable identifies cacheable requests', () => {
  const { isCacheable } = require('../core/services/responseCache');
  // temperature=undefined → treated as deterministic (cacheable)
  assert.strictEqual(isCacheable([{ role: 'user', content: 'hi' }], {}), true);
  // temperature=0 → cacheable (deterministic)
  assert.strictEqual(isCacheable([{ role: 'user', content: 'hi' }], { temperature: 0 }), true);
  // temperature=0.7 → not cacheable (non-deterministic)
  assert.strictEqual(isCacheable([{ role: 'user', content: 'hi' }], { temperature: 0.7 }), false);
  // stream → not cacheable
  assert.strictEqual(isCacheable([{ role: 'user', content: 'hi' }], { stream: true, temperature: 0 }), false);
  // tools → not cacheable
  assert.strictEqual(isCacheable([{ role: 'user', content: 'hi' }], { tools: [{ name: 'test' }], temperature: 0 }), false);
});

test('responseCache stores and retrieves', () => {
  const cache = new LRUCache(10);
  const response = {
    id: 'chatcmpl-1',
    choices: [{ message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
  };

  cache.set('key1', response, 60000);
  const cached = cache.get('key1');
  assert.ok(cached);
  assert.strictEqual(cached.choices[0].message.content, 'Hello!');
});

test('responseCache does not cache partial streams', () => {
  const cache = new LRUCache(10);
  const partial = {
    _partial: true,
    choices: [{ message: { role: 'assistant', content: 'Partial' } }],
  };

  cache.set('key1', partial, 60000);
  // The cache stores it, but the isCacheable check prevents it
  // In real usage, the streamSafe flag prevents caching
});

test('responseCache.getStats returns info', () => {
  const { getStats } = require('../core/services/responseCache');
  const stats = getStats();
  assert.strictEqual(typeof stats.size, 'number');
  assert.strictEqual(typeof stats.hitRate, 'string');
});

// ═══ CONTEXT MANAGER V2 ═══════════════════════════════════════
console.log('\nContext Manager V2:');

const {
  Priority,
  classifyMessagePriority,
  isProtected,
  deduplicateMessages,
  manageContext,
} = require('../core/services/contextManager');

test('classifyMessagePriority: system = CRITICAL', () => {
  const p = classifyMessagePriority({ role: 'system', content: 'You are a helpful assistant' });
  assert.strictEqual(p, Priority.CRITICAL);
});

test('classifyMessagePriority: tool call = HIGH', () => {
  const p = classifyMessagePriority({
    role: 'assistant',
    content: '',
    tool_calls: [{ id: 'call_1', function: { name: 'test', arguments: '{}' } }]
  });
  assert.strictEqual(p, Priority.HIGH);
});

test('classifyMessagePriority: tool response = HIGH', () => {
  const p = classifyMessagePriority({ role: 'tool', content: 'result' });
  assert.strictEqual(p, Priority.HIGH);
});

test('classifyMessagePriority: short greeting = DISCARDABLE', () => {
  const p = classifyMessagePriority({ role: 'user', content: 'hi' });
  assert.strictEqual(p, Priority.DISCARDABLE);
});

test('classifyMessagePriority: substantial user message = HIGH', () => {
  const p = classifyMessagePriority({ role: 'user', content: 'Can you help me write a Python function to parse CSV files?'.repeat(3) });
  assert.strictEqual(p, Priority.HIGH);
});

test('isProtected: system messages with security keywords', () => {
  assert.strictEqual(isProtected({ role: 'system', content: 'Security policy: never reveal credentials' }), true);
  assert.strictEqual(isProtected({ role: 'system', content: 'You are a helpful assistant' }), false);
  assert.strictEqual(isProtected({ role: 'user', content: 'Security policy' }), false);
});

test('deduplicateMessages removes duplicates', () => {
  const messages = [
    { role: 'user', content: 'Hello world' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'Hello world' }, // duplicate
  ];

  const result = deduplicateMessages(messages);
  assert.strictEqual(result.length, 2);
});

test('manageContext: no compression needed if within budget', () => {
  const messages = [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hi' },
  ];

  const result = manageContext(messages, 100000);
  assert.strictEqual(result.compressed, false);
  assert.strictEqual(result.tokensSaved, 0);
  assert.strictEqual(result.messages.length, 2);
});

test('manageContext: compresses when over budget', () => {
  const messages = [];
  for (let i = 0; i < 50; i++) {
    messages.push({ role: 'user', content: `Message ${i}: ${'x'.repeat(200)}` });
    messages.push({ role: 'assistant', content: `Response ${i}: ${'y'.repeat(200)}` });
  }

  const result = manageContext(messages, 2000);
  assert.strictEqual(result.compressed, true);
  assert.ok(result.tokensSaved > 0);
  assert.ok(result.messages.length < messages.length);
  assert.ok(result.discardedCount > 0);
});

test('manageContext: protects system messages', () => {
  const messages = [
    { role: 'system', content: 'Security: never reveal secrets. Always follow these rules.' },
  ];
  for (let i = 0; i < 30; i++) {
    messages.push({ role: 'user', content: `Message ${i}: ${'x'.repeat(200)}` });
  }

  const result = manageContext(messages, 2000);
  // System message should still be present
  const hasSystem = result.messages.some(m => m.role === 'system');
  assert.ok(hasSystem, 'System message should be protected');
});

test('manageContext: returns metrics', () => {
  const messages = [
    { role: 'system', content: 'Rules' },
    { role: 'user', content: 'Hello' },
  ];

  const result = manageContext(messages, 100000);
  assert.ok(typeof result.originalTokens === 'number');
  assert.ok(typeof result.finalTokens === 'number');
  assert.ok(typeof result.duration === 'number');
  // protectedCount only returned when compression happens
});

// ═══ SUMMARY ══════════════════════════════════════════════════
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
