/**
 * Tests pour ModelCapabilityRegistry
 */
const assert = require('assert');
const {
  initializeRegistry,
  getCapabilities,
  findModelsByCapabilities,
  hasCapability,
  getAllCapabilities,
  DEFAULT_CAPABILITIES,
} = require('../core/services/modelCapabilityRegistry');

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

console.log('\n🔍 ModelCapabilityRegistry Tests\n');

// Mock DB models
const mockModels = [
  { platform: 'google', modelId: 'gemini-2.5-pro', contextWindow: 1048576 },
  { platform: 'google', modelId: 'gemini-2.5-flash', contextWindow: 1048576 },
  { platform: 'groq', modelId: 'llama-3.3-70b-versatile', contextWindow: 131072 },
  { platform: 'mistral', modelId: 'mistral-large-latest', contextWindow: 131072 },
  { platform: 'mistral', modelId: 'codestral-latest', contextWindow: 32000 },
  { platform: 'openrouter', modelId: 'qwen/qwen3-coder:free', contextWindow: 262144 },
  { platform: 'ollama', modelId: 'deepseek-v3.2', contextWindow: 131072 },
  { platform: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct', contextWindow: 131072 },
  { platform: 'kilo', modelId: 'nvidia/nemotron-3-super-120b-a12b:free', contextWindow: 262144 },
];

// --- initializeRegistry ---
console.log('initializeRegistry:');

test('populates registry from models', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('google', 'gemini-2.5-pro');
  assert.ok(caps);
  assert.strictEqual(caps.text, true);
});

test('applies platform defaults for Google', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('google', 'gemini-2.5-flash');
  assert.strictEqual(caps.tool_calling, true);
  assert.strictEqual(caps.vision, true);
  assert.strictEqual(caps.streaming, true);
});

test('applies model overrides for Gemini Pro', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('google', 'gemini-2.5-pro');
  assert.strictEqual(caps.reasoning, true);
  assert.strictEqual(caps.coding, true);
  assert.strictEqual(caps.long_context, true);
  assert.strictEqual(caps.maxContextWindow, 1048576);
});

test('applies model override for Codestral (coding)', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('mistral', 'codestral-latest');
  assert.strictEqual(caps.coding, true);
  assert.strictEqual(caps.maxContextWindow, 32000);
});

test('returns defaults for unknown model', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('unknown', 'unknown-model');
  assert.strictEqual(caps.text, true);
  assert.strictEqual(caps.vision, false);
  assert.strictEqual(caps.tool_calling, false);
});

test('Groq models have tool_calling from platform defaults', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('groq', 'llama-3.3-70b-versatile');
  assert.strictEqual(caps.tool_calling, true);
});

test('NVIDIA models have tool_calling=false from platform defaults', () => {
  initializeRegistry(mockModels);
  const caps = getCapabilities('nvidia', 'meta/llama-3.3-70b-instruct');
  assert.strictEqual(caps.tool_calling, false);
});

// --- findModelsByCapabilities ---
console.log('\nfindModelsByCapabilities:');

test('finds models with vision capability', () => {
  initializeRegistry(mockModels);
  const allKeys = mockModels.map(m => `${m.platform}:${m.modelId}`);
  const matches = findModelsByCapabilities({ vision: true }, allKeys);
  assert.ok(matches.length > 0);
  assert.ok(matches.some(m => m.includes('google')));
});

test('finds models with tool_calling', () => {
  initializeRegistry(mockModels);
  const allKeys = mockModels.map(m => `${m.platform}:${m.modelId}`);
  const matches = findModelsByCapabilities({ tool_calling: true }, allKeys);
  assert.ok(matches.length > 0);
  // Should include google, groq, mistral-large, openrouter, ollama
  assert.ok(matches.some(m => m.includes('google')));
  assert.ok(matches.some(m => m.includes('groq')));
});

test('finds coding-optimized models', () => {
  initializeRegistry(mockModels);
  const allKeys = mockModels.map(m => `${m.platform}:${m.modelId}`);
  const matches = findModelsByCapabilities({ coding: true }, allKeys);
  assert.ok(matches.length > 0);
  assert.ok(matches.some(m => m.includes('codestral')));
  assert.ok(matches.some(m => m.includes('qwen3-coder')));
});

test('finds models with long context >= 100k', () => {
  initializeRegistry(mockModels);
  const allKeys = mockModels.map(m => `${m.platform}:${m.modelId}`);
  const matches = findModelsByCapabilities({ long_context: true }, allKeys);
  assert.ok(matches.length >= 3); // google, openrouter coder, ollama deepseek
});

test('returns empty for impossible combination', () => {
  initializeRegistry(mockModels);
  const allKeys = mockModels.map(m => `${m.platform}:${m.modelId}`);
  const matches = findModelsByCapabilities({ audio: true }, allKeys);
  assert.strictEqual(matches.length, 0, `Expected 0 audio-capable models, got ${matches.length}`);
});

// --- hasCapability ---
console.log('\nhasCapability:');

test('Google Gemini has vision', () => {
  initializeRegistry(mockModels);
  assert.strictEqual(hasCapability('google', 'gemini-2.5-pro', 'vision'), true);
});

test('Codestral does not have vision', () => {
  initializeRegistry(mockModels);
  assert.strictEqual(hasCapability('mistral', 'codestral-latest', 'vision'), false);
});

// --- getAllCapabilities ---
console.log('\ngetAllCapabilities:');

test('returns all registered capabilities', () => {
  initializeRegistry(mockModels);
  const all = getAllCapabilities();
  assert.strictEqual(all.length, mockModels.length);
  assert.ok(all.some(c => c.platform === 'google' && c.modelId === 'gemini-2.5-pro'));
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
