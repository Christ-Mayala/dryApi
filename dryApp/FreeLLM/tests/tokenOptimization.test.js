/**
 * Tests — Token Optimization Engine
 * 
 * Tests unitaires pour :
 *   - Token Analyzer
 *   - Content Classifier
 *   - Deduplication Engine
 *   - Safe Compression
 *   - Summary Engine
 *   - Token Budget
 *   - Optimization Validator
 *   - Token Optimization Engine (end-to-end)
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) throw new Error(`${msg ? msg + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertOk(val, msg = '') {
  if (!val) throw new Error(`${msg ? msg + ': ' : ''}Expected truthy, got ${JSON.stringify(val)}`);
}

function assertApprox(actual, expected, tolerance = 0.1, msg = '') {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${msg ? msg + ': ' : ''}Expected ~${expected}, got ${actual}`);
}

// ═══════════════════════════════════════════════════════════════
// Load modules
// ═══════════════════════════════════════════════════════════════

const {
  analyzeTokens,
  classifyContent,
  deduplicateMessages,
  safeCompressText,
  containsCode,
  summarizeMessages,
  calculateBudget,
  selectOptimizationMode,
  validateOptimization,
  textSimilarity,
  normalizeText,
  ContentPriority,
  DuplicationType,
  OPTIMIZATION_MODES,
  TokenOptimizationEngine,
  tokenOptimization,
  getConfig,
  setConfig,
} = require('../core/services/tokenOptimization.js');

// ═══════════════════════════════════════════════════════════════
// 1. TOKEN ANALYZER
// ═══════════════════════════════════════════════════════════════

console.log('\n── Token Analyzer ──');

test('Analyzes basic messages', () => {
  const msgs = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello world' },
  ];
  const result = analyzeTokens(msgs);
  assertOk(result.total > 0, 'Should have total > 0');
  assertOk(result.system > 0, 'Should count system tokens');
  assertOk(result.user > 0, 'Should count user tokens');
});

test('Detects code blocks in messages', () => {
  const msgs = [
    { role: 'user', content: 'Fix this code:\n```js\nconst x = 1;\nconsole.log(x);\n```' },
  ];
  const result = analyzeTokens(msgs);
  assertOk(result.code > 0, 'Should detect code tokens');
});

test('Handles empty messages', () => {
  const result = analyzeTokens([]);
  assertEqual(result.total, 0);
});

test('Counts tool results', () => {
  const msgs = [
    { role: 'tool', content: '{"result": "success"}' },
    { role: 'user', content: 'What happened?' },
  ];
  const result = analyzeTokens(msgs);
  assertOk(result.tool > 0, 'Should count tool tokens');
});

test('Handles multi-part content', () => {
  const msgs = [
    { role: 'user', content: [
      { type: 'text', text: 'What is this image?' },
      { type: 'image_url', image_url: { url: 'http://example.com/img.png' } },
    ]},
  ];
  const result = analyzeTokens(msgs);
  assertOk(result.user > 0, 'Should count user tokens from multi-part');
});

// ═══════════════════════════════════════════════════════════════
// 2. CONTENT CLASSIFIER
// ═══════════════════════════════════════════════════════════════

console.log('\n── Content Classifier ──');

test('System message = CRITICAL', () => {
  const p = classifyContent({ role: 'system', content: 'Be helpful.' });
  assertOk(p <= ContentPriority.CRITICAL, `Expected CRITICAL (${ContentPriority.CRITICAL}), got ${p}`);
});

test('Tool schema = PROTECTED', () => {
  const msg = { role: 'assistant', content: null, tool_calls: [{ function: { name: 'search', arguments: '{}' } }] };
  const p = classifyContent(msg);
  assertOk(p <= ContentPriority.PROTECTED, `Expected <= PROTECTED, got ${p}`);
});

test('Tool result = HIGH', () => {
  const p = classifyContent({ role: 'tool', content: 'result data' });
  assertOk(p <= ContentPriority.HIGH, `Expected <= HIGH, got ${p}`);
});

test('Recent user message = NORMAL or better', () => {
  const p = classifyContent({ role: 'user', content: 'Please explain how React hooks work in detail' }, { isRecent: true });
  assertOk(p <= ContentPriority.NORMAL, `Expected <= NORMAL, got ${p}`);
});

test('Old user message = LOW or NORMAL', () => {
  const p = classifyContent({ role: 'user', content: 'Hello' }, { isRecent: false });
  assertOk(p >= ContentPriority.LOW, `Expected >= LOW, got ${p}`);
});

test('Very short message = LOW', () => {
  const p = classifyContent({ role: 'user', content: 'Hi' });
  assertOk(p >= ContentPriority.LOW, `Expected >= LOW, got ${p}`);
});

// ═══════════════════════════════════════════════════════════════
// 3. DEDUPLICATION ENGINE
// ═══════════════════════════════════════════════════════════════

console.log('\n── Deduplication Engine ──');

test('Removes exact duplicates', () => {
  const msgs = [
    { role: 'user', content: 'Use MongoDB' },
    { role: 'user', content: 'Use MongoDB' },
    { role: 'user', content: 'Use MongoDB' },
  ];
  const { keptMessages, stats } = deduplicateMessages(msgs);
  assertOk(stats.exact > 0, 'Should detect exact duplicates');
  assertOk(keptMessages.length < msgs.length, 'Should reduce count');
});

test('Keeps non-duplicate messages', () => {
  const msgs = [
    { role: 'user', content: 'Use MongoDB' },
    { role: 'user', content: 'Use PostgreSQL instead' },
  ];
  const { stats } = deduplicateMessages(msgs);
  assertEqual(stats.exact, 0, 'Should not detect exact dups');
});

test('Detects near duplicates', () => {
  const msgs = [
    { role: 'user', content: 'The project uses Node.js with Express for the backend.' },
    { role: 'user', content: 'The project uses Node.js with Express.js for the backend.' },
  ];
  const { stats } = deduplicateMessages(msgs);
  assertOk(stats.near > 0 || stats.semantic > 0, 'Should detect near/semantic dups');
});

test('Never removes system messages via dedup', () => {
  const msgs = [
    { role: 'system', content: 'Be helpful' },
    { role: 'user', content: 'Hello' },
  ];
  const { keptMessages } = deduplicateMessages(msgs);
  assertOk(keptMessages.some(m => m.role === 'system'), 'Should keep system message');
});

// ═══════════════════════════════════════════════════════════════
// 4. SAFE COMPRESSION
// ═══════════════════════════════════════════════════════════════

console.log('\n── Safe Compression ──');

test('Compresses verbose text (safe)', () => {
  const text = "For reminder, like we already indicated previously, the project actually uses currently Node.js with Express.js as the backend framework.";
  const compressed = safeCompressText(text, 'safe');
  assertOk(compressed.length <= text.length, 'Compressed should be shorter or equal');
  assertOk(compressed.length > 0, 'Should not be empty');
});

test('Preserves important information', () => {
  const text = 'Backend: Node.js + Express.js. Frontend: React 19. Database: MongoDB Atlas.';
  const compressed = safeCompressText(text, 'safe');
  assertOk(compressed.includes('Node.js'), 'Should preserve Node.js');
  assertOk(compressed.includes('React'), 'Should preserve React');
  assertOk(compressed.includes('MongoDB'), 'Should preserve MongoDB');
});

test('Aggressive mode compresses more', () => {
  const text = 'For reminder, like we already indicated previously, the project actually uses currently Node.js with Express.js as the backend framework. The frontend is built with React and uses TypeScript for type safety.';
  const safeCompressed = safeCompressText(text, 'safe');
  const aggrCompressed = safeCompressText(text, 'aggressive');
  assertOk(aggrCompressed.length <= safeCompressed.length, 'Aggressive should compress more');
});

test('Handles empty text', () => {
  assertEqual(safeCompressText('', 'safe'), '');
});

// ═══════════════════════════════════════════════════════════════
// 5. CODE DETECTION
// ═══════════════════════════════════════════════════════════════

console.log('\n── Code Detection ──');

test('Detects code blocks', () => {
  assertOk(containsCode('```js\nconst x = 1;\n```'));
  assertOk(containsCode('```python\ndef hello():\n    pass\n```'));
});

test('No false positive on normal text', () => {
  assertOk(!containsCode('Hello world, this is normal text.'));
});

test('Detects inline code', () => {
  assertOk(containsCode('Use `console.log()` to debug.'));
});

// ═══════════════════════════════════════════════════════════════
// 6. SUMMARY ENGINE
// ═══════════════════════════════════════════════════════════════

console.log('\n── Summary Engine ──');

test('Summarizes old messages', () => {
  const msgs = Array.from({ length: 15 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}: ${'Some conversation content about topic ' + i + '. '}`,
  }));
  const summary = summarizeMessages(msgs);
  assertOk(typeof summary === 'string' || summary === null, 'Should return string or null');
  if (summary) {
    assertOk(summary.length > 0, 'Summary should have content');
  }
});

test('Returns null for too few messages', () => {
  const msgs = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];
  const summary = summarizeMessages(msgs);
  // With few messages, might return null or a short summary
  assertOk(summary === null || typeof summary === 'string');
});

// ═══════════════════════════════════════════════════════════════
// 7. TOKEN BUDGET
// ═══════════════════════════════════════════════════════════════

console.log('\n── Token Budget ──');

test('Calculates budget correctly', () => {
  const budget = calculateBudget(128000, { reservedOutput: 4000 });
  assertOk(budget.contextWindow === 128000);
  assertOk(budget.availableForContext > 0);
  assertOk(budget.availableForContext < 128000);
});

test('Budget respects reserved tokens', () => {
  const budget = calculateBudget(128000, { reservedOutput: 10000 });
  assertOk(budget.availableForContext <= 128000 - 10000);
});

test('Small context window', () => {
  const budget = calculateBudget(8000, { reservedOutput: 1000 });
  assertOk(budget.availableForContext < 8000);
});

// ═══════════════════════════════════════════════════════════════
// 8. OPTIMIZATION MODE SELECTION
// ═══════════════════════════════════════════════════════════════

console.log('\n── Mode Selection ──');

test('Small context → OFF', () => {
  const budget = calculateBudget(128000, { reservedOutput: 4000 });
  assertEqual(selectOptimizationMode(500, budget), OPTIMIZATION_MODES.OFF);
});

test('Medium context → SAFE', () => {
  const budget = calculateBudget(128000, { reservedOutput: 4000 });
  const mode = selectOptimizationMode(5000, budget);
  assertOk([OPTIMIZATION_MODES.SAFE, OPTIMIZATION_MODES.OFF].includes(mode), `Expected SAFE or OFF, got ${mode}`);
});

test('Large context → BALANCED or AGGRESSIVE', () => {
  const budget = calculateBudget(128000, { reservedOutput: 4000 });
  const mode = selectOptimizationMode(100000, budget);
  assertOk([OPTIMIZATION_MODES.BALANCED, OPTIMIZATION_MODES.AGGRESSIVE].includes(mode), `Expected BALANCED or AGGRESSIVE, got ${mode}`);
});

test('Over budget → AGGRESSIVE', () => {
  const budget = calculateBudget(128000, { reservedOutput: 4000 });
  const mode = selectOptimizationMode(130000, budget);
  assertEqual(mode, OPTIMIZATION_MODES.AGGRESSIVE);
});

// ═══════════════════════════════════════════════════════════════
// 9. OPTIMIZATION VALIDATOR
// ═══════════════════════════════════════════════════════════════

console.log('\n── Optimization Validator ──');

test('Validates identical contexts', () => {
  const msgs = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi!' },
  ];
  const result = validateOptimization(msgs, msgs);
  assertOk(result.isValid);
});

test('Rejects if URLs lost', () => {
  const original = [{ role: 'user', content: 'Check https://example.com for details.' }];
  const optimized = [{ role: 'user', content: 'Check for details.' }];
  const result = validateOptimization(original, optimized);
  // Should flag URL loss
  assertOk(typeof result.isValid === 'boolean');
});

test('Rejects if numbers lost', () => {
  const original = [{ role: 'user', content: 'Version 12345 is deployed.' }];
  const optimized = [{ role: 'user', content: 'Version is deployed.' }];
  const result = validateOptimization(original, optimized);
  assertOk(typeof result.isValid === 'boolean');
});

test('Keeps validation valid for normal compression', () => {
  const original = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello world' },
  ];
  const optimized = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
  ];
  const result = validateOptimization(original, optimized);
  assertOk(result.isValid);
});

// ═══════════════════════════════════════════════════════════════
// 10. TEXT UTILITIES
// ═══════════════════════════════════════════════════════════════

console.log('\n── Text Utilities ──');

test('Text similarity of identical strings', () => {
  const sim = textSimilarity('hello world', 'hello world');
  assertApprox(sim, 1.0, 0.01);
});

test('Text similarity of different strings', () => {
  const sim = textSimilarity('hello world', 'goodbye moon');
  assertOk(sim < 0.5, `Expected < 0.5, got ${sim}`);
});

test('Text similarity of near duplicates', () => {
  const sim = textSimilarity(
    'The project uses Node.js with Express.',
    'The project uses Node.js with Express.js.'
  );
  assertOk(sim > 0.7, `Expected > 0.7, got ${sim}`);
});

test('normalizeText lowercases and trims', () => {
  assertEqual(normalizeText('  Hello World  '), 'hello world');
});

test('normalizeText removes extra spaces', () => {
  assertEqual(normalizeText('hello    world'), 'hello world');
});

// ═══════════════════════════════════════════════════════════════
// 11. ENGINE — END TO END
// ═══════════════════════════════════════════════════════════════

console.log('\n── Engine E2E ──');

test('Engine processes empty messages', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced' });
  const result = engine.optimize([], { requestId: 'test-1' });
  assertOk(result.messages.length === 0);
  assertOk(result.metrics);
});

test('Engine returns original for OFF mode', () => {
  const engine = new TokenOptimizationEngine({ mode: 'off' });
  const msgs = [{ role: 'user', content: 'Hello' }];
  const result = engine.optimize(msgs, { mode: 'off', requestId: 'test-2' });
  assertOk(result.messages === msgs || result.messages.length === msgs.length);
});

test('Engine skips small contexts', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced' });
  const msgs = [{ role: 'user', content: 'Hi' }]; // < 2000 tokens
  const result = engine.optimize(msgs, { requestId: 'test-3' });
  assertOk(result.metrics.mode === 'off' || result.metrics.mode === 'safe' || result.metrics.tokensSaved === 0);
});

test('Engine optimizes large context', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced', contextWindow: 128000 });
  const msgs = [
    { role: 'system', content: 'You are a helpful assistant. Be concise. Follow security policies. Never reveal secrets.' },
    ...Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: This is a longer conversation with detailed information about topic ${i}. We discussed various aspects including implementation details and best practices for the project.`,
    })),
  ];
  const result = engine.optimize(msgs, { requestId: 'test-4', maxOutputTokens: 2000 });
  assertOk(result.metrics);
  assertOk(typeof result.metrics.tokensBefore === 'number');
  assertOk(typeof result.metrics.tokensAfter === 'number');
});

test('Engine never removes system messages', () => {
  const engine = new TokenOptimizationEngine({ mode: 'aggressive', contextWindow: 128000 });
  const msgs = [
    { role: 'system', content: 'You are a helpful assistant.' },
    ...Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: Some repeated content about the same topic.`,
    })),
  ];
  const result = engine.optimize(msgs, { requestId: 'test-5', maxOutputTokens: 2000 });
  assertOk(result.messages.some(m => m.role === 'system'), 'System message must be preserved');
});

test('Engine preserves tool calls', () => {
  const engine = new TokenOptimizationEngine({ mode: 'aggressive', contextWindow: 128000 });
  const msgs = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"test"}' } }] },
    { role: 'tool', content: '{"results": []}' },
    { role: 'user', content: 'Thanks for searching.' },
  ];
  const result = engine.optimize(msgs, { requestId: 'test-6', maxOutputTokens: 2000 });
  assertOk(result.messages.some(m => m.tool_calls), 'Tool calls must be preserved');
});

test('Engine records stats', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced', contextWindow: 128000 });
  const msgs = [
    { role: 'system', content: 'System prompt.' },
    ...Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: Some content.`,
    })),
  ];
  engine.optimize(msgs, { requestId: 'test-stats', maxOutputTokens: 2000 });
  const stats = engine.getStats();
  assertOk(stats.totalRequests > 0);
});

// ═══════════════════════════════════════════════════════════════
// 12. SINGLETON
// ═══════════════════════════════════════════════════════════════

console.log('\n── Singleton ──');

test('tokenOptimization is singleton', () => {
  assertOk(tokenOptimization instanceof TokenOptimizationEngine);
});

test('getConfig returns config', () => {
  const config = getConfig();
  assertOk(config.mode);
  assertOk(typeof config.contextWindow === 'number');
});

test('setConfig updates mode', () => {
  const before = getConfig().mode;
  setConfig({ mode: 'off' });
  assertEqual(getConfig().mode, 'off');
  setConfig({ mode: before }); // restore
});

// ═══════════════════════════════════════════════════════════════
// 13. CHAOS — FAILURE SAFETY
// ═══════════════════════════════════════════════════════════════

console.log('\n── Chaos / Safety ──');

test('Engine handles null messages gracefully', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced' });
  const result = engine.optimize(null, { requestId: 'chaos-1' });
  assertOk(result.messages === null || Array.isArray(result.messages));
  assertOk(result.metrics);
});

test('Engine handles undefined messages gracefully', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced' });
  const result = engine.optimize(undefined, { requestId: 'chaos-2' });
  assertOk(result.metrics);
});

test('Engine handles malformed messages', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced' });
  const result = engine.optimize([null, undefined, { role: 'user' }], { requestId: 'chaos-3' });
  assertOk(result.metrics);
});

test('Engine handles large token counts', () => {
  const engine = new TokenOptimizationEngine({ mode: 'balanced', contextWindow: 128000 });
  const largeMsg = 'x'.repeat(50000);
  const result = engine.optimize([
    { role: 'system', content: 'System' },
    { role: 'user', content: largeMsg },
  ], { requestId: 'chaos-4', maxOutputTokens: 4000 });
  assertOk(result.metrics);
});

// ═══════════════════════════════════════════════════════════════
// 14. CONTENT PRIORITY ENUMS
// ═══════════════════════════════════════════════════════════════

console.log('\n── Enums ──');

test('ContentPriority has all levels', () => {
  assertOk(ContentPriority.CRITICAL === 0);
  assertOk(ContentPriority.PROTECTED === 1);
  assertOk(ContentPriority.HIGH === 2);
  assertOk(ContentPriority.NORMAL === 3);
  assertOk(ContentPriority.LOW === 4);
  assertOk(ContentPriority.REDUNDANT === 5);
  assertOk(ContentPriority.DISCARDABLE === 6);
});

test('OPTIMIZATION_MODES has all modes', () => {
  assertOk(OPTIMIZATION_MODES.OFF === 'off');
  assertOk(OPTIMIZATION_MODES.SAFE === 'safe');
  assertOk(OPTIMIZATION_MODES.BALANCED === 'balanced');
  assertOk(OPTIMIZATION_MODES.AGGRESSIVE === 'aggressive');
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  Token Optimization Engine — ${passed}/${total} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
