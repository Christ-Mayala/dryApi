/**
 * Tests pour ResponseValidator
 */
const assert = require('assert');
const { validateResponse, sanitizeResponse, ValidationIssue, chunkHasMeaningfulContent } = require('../core/services/responseValidator');

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

console.log('\n🔍 ResponseValidator Tests\n');

// --- validateResponse ---
console.log('validateResponse:');

test('rejects null response', () => {
  const result = validateResponse(null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.includes(ValidationIssue.EMPTY_RESPONSE));
});

test('rejects non-object response', () => {
  const result = validateResponse('not an object');
  assert.strictEqual(result.valid, false);
});

test('rejects response without choices', () => {
  const result = validateResponse({ id: '123' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.includes(ValidationIssue.MISSING_CHOICES));
});

test('rejects response with empty choices', () => {
  const result = validateResponse({ id: '123', choices: [] });
  assert.strictEqual(result.valid, false);
});

test('rejects response without message', () => {
  const result = validateResponse({
    id: '123',
    choices: [{ index: 0, finish_reason: 'stop' }]
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.includes(ValidationIssue.WRONG_FORMAT));
});

test('rejects response with empty content', () => {
  const result = validateResponse({
    id: '123',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: '' },
      finish_reason: 'stop'
    }]
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.includes(ValidationIssue.EMPTY_CONTENT));
});

test('accepts valid response with text content', () => {
  const result = validateResponse({
    id: '123',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'Hello world' },
      finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.issues.length, 0);
});

test('accepts response with tool calls', () => {
  const result = validateResponse({
    id: '123',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } }]
      },
      finish_reason: 'tool_calls'
    }]
  }, { allowEmptyContent: true });
  assert.strictEqual(result.valid, true);
});

test('flags truncated response', () => {
  const result = validateResponse({
    id: '123',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'Partial response...' },
      finish_reason: 'length'
    }]
  });
  assert.strictEqual(result.valid, true);
  assert.ok(result.issues.includes(ValidationIssue.TRUNCATED));
});

test('handles array content format via sanitization', () => {
  // Array content is not valid text but sanitizeResponse converts it
  const raw = {
    id: '123',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }]
      },
      finish_reason: 'stop'
    }]
  };
  // Sanitize first, then validate
  const sanitized = sanitizeResponse(raw);
  const result = validateResponse(sanitized);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.sanitizedResponse.choices[0].message.content, 'Hello');
});

test('adds usage object if missing', () => {
  const result = validateResponse({
    id: '123',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'test' },
      finish_reason: 'stop'
    }]
  });
  assert.strictEqual(result.valid, true);
  assert.ok(result.sanitizedResponse.usage);
  assert.strictEqual(result.sanitizedResponse.usage.total_tokens, 0);
});

// --- sanitizeResponse ---
console.log('\nsanitizeResponse:');

test('sanitizes null content to empty string', () => {
  const result = sanitizeResponse({
    choices: [{ message: { role: 'assistant', content: null } }]
  });
  assert.strictEqual(result.choices[0].message.content, '');
});

test('ensures finish_reason exists', () => {
  const result = sanitizeResponse({
    choices: [{ message: { role: 'assistant', content: 'test' } }]
  });
  assert.strictEqual(result.choices[0].finish_reason, 'stop');
});

test('ensures index exists', () => {
  const result = sanitizeResponse({
    choices: [{ message: { role: 'assistant', content: 'test' } }]
  });
  assert.strictEqual(result.choices[0].index, 0);
});

// --- chunkHasMeaningfulContent (P3 — normalisation du streaming) ---
console.log('\nchunkHasMeaningfulContent:');

test('detects delta.content', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { content: 'Hello' } }] }), true);
});

test('detects delta.reasoning_content', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { reasoning_content: 'thinking...' } }] }), true);
});

test('detects delta.tool_calls', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { tool_calls: [{ id: 'c1' }] } }] }), true);
});

test('detects message.content (non-stream shape)', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ message: { content: 'Hi' } }] }), true);
});

test('ignores role-only delta', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { role: 'assistant' } }] }), false);
});

test('ignores empty content delta', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { content: '' } }] }), false);
});

test('ignores finish_reason-only chunk', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: {}, finish_reason: 'stop' }] }), false);
});

test('treats content_filter finish as meaningful', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: {}, finish_reason: 'content_filter' }] }), true);
});

test('returns false for empty choices / null chunk', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [] }), false);
  assert.strictEqual(chunkHasMeaningfulContent(null), false);
});

test('detects delta.content as array of text blocks', () => {
  assert.strictEqual(
    chunkHasMeaningfulContent({ choices: [{ delta: { content: [{ type: 'text', text: 'Hi' }] } }] }),
    true
  );
});

test('detects message.content as array of text blocks', () => {
  assert.strictEqual(
    chunkHasMeaningfulContent({ choices: [{ message: { content: [{ type: 'text', text: 'Hi' }] } }] }),
    true
  );
});

test('ignores empty array content', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: { content: [] } }] }), false);
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ message: { content: [] } }] }), false);
});

test('ignores usage-only chunk (no content produced)', () => {
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [], usage: { total_tokens: 5 } }), false);
  assert.strictEqual(chunkHasMeaningfulContent({ choices: [{ delta: {} }], usage: { total_tokens: 5 } }), false);
});

test('ignores [DONE] marker (not a content chunk)', () => {
  assert.strictEqual(chunkHasMeaningfulContent('[DONE]'), false);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
