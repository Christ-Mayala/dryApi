/**
 * Tests pour ErrorClassifier
 */
const assert = require('assert');
const { classifyError, ErrorCategory, extractHttpCode, extractRetryAfter, looksLikeModelUnavailable } = require('../core/services/errorClassifier');
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

console.log('\n🔍 ErrorClassifier Tests\n');

// --- extractHttpCode ---
console.log('extractHttpCode:');

test('extracts 429 from message', () => {
  assert.strictEqual(extractHttpCode('API error 429: rate limited'), 429);
});

test('extracts 401 from message', () => {
  assert.strictEqual(extractHttpCode('Error 401 unauthorized'), 401);
});

test('extracts 500 from message', () => {
  assert.strictEqual(extractHttpCode('Internal server error 500'), 500);
});

test('returns null for no code', () => {
  assert.strictEqual(extractHttpCode('some random error'), null);
});

test('returns null for null input', () => {
  assert.strictEqual(extractHttpCode(null), null);
});

// --- extractRetryAfter ---
console.log('\nextractRetryAfter:');

test('extracts "retry after 30s"', () => {
  assert.strictEqual(extractRetryAfter('Rate limited, retry after 30s'), 30000);
});

test('extracts "retry in 5"', () => {
  assert.strictEqual(extractRetryAfter('try again in 5'), 5000);
});

test('extracts "wait 10.5s"', () => {
  assert.strictEqual(extractRetryAfter('Please wait 10.5s'), 10500);
});

test('returns null for no delay', () => {
  assert.strictEqual(extractRetryAfter('some error'), null);
});

// --- classifyError ---
console.log('\nclassifyError:');

test('classifies timeout', () => {
  const result = classifyError(new Error('ETIMEDOUT connect'));
  assert.strictEqual(result.category, ErrorCategory.TIMEOUT);
  assert.strictEqual(result.retryable, true);
  assert.strictEqual(result.blacklistKey, false);
});

test('classifies 429 rate limit', () => {
  const result = classifyError(new Error('API error 429: Too many requests'));
  assert.strictEqual(result.category, ErrorCategory.RATE_LIMIT);
  assert.strictEqual(result.retryable, true);
  assert.strictEqual(result.skipToNextKey, true);
});

test('classifies 401 auth error', () => {
  const result = classifyError(new Error('401 Unauthorized'));
  assert.strictEqual(result.category, ErrorCategory.AUTH_ERROR);
  assert.strictEqual(result.retryable, false);
  assert.strictEqual(result.blacklistKey, true);
});

test('classifies 403 forbidden', () => {
  const result = classifyError(new Error('403 Forbidden'));
  assert.strictEqual(result.category, ErrorCategory.AUTH_ERROR);
  assert.strictEqual(result.blacklistKey, true);
});

test('classifies 400 invalid request', () => {
  const result = classifyError(new Error('400 Bad Request: invalid parameter'));
  assert.strictEqual(result.category, ErrorCategory.INVALID_REQUEST);
  assert.strictEqual(result.retryable, false);
});

test('classifies 500 server error', () => {
  const result = classifyError(new Error('500 Internal Server Error'));
  assert.strictEqual(result.category, ErrorCategory.SERVER_ERROR);
  assert.strictEqual(result.retryable, true);
});

test('classifies network error', () => {
  const result = classifyError(new Error('ECONNREFUSED 127.0.0.1:443'));
  assert.strictEqual(result.category, ErrorCategory.NETWORK_ERROR);
  assert.strictEqual(result.retryable, true);
  assert.strictEqual(result.skipToNextKey, false);
});

test('classifies quota exceeded', () => {
  const result = classifyError(new Error('quota exceeded for this key'));
  assert.strictEqual(result.category, ErrorCategory.QUOTA_EXCEEDED);
  assert.strictEqual(result.cooldownMs, 3600000);
});

test('classifies content policy', () => {
  const result = classifyError(new Error('Content policy violation'));
  assert.strictEqual(result.category, ErrorCategory.CONTENT_POLICY);
  assert.strictEqual(result.retryable, false);
});

test('classifies model unavailable', () => {
  const result = classifyError(new Error('model not found: gpt-5'));
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
  assert.strictEqual(result.retryable, true);
});

test('classifies stream interrupted', () => {
  const result = classifyError(new Error('stream interrupted by provider'));
  assert.strictEqual(result.category, ErrorCategory.STREAM_INTERRUPTED);
  assert.strictEqual(result.retryable, true);
});

test('defaults to UNKNOWN for unrecognized errors', () => {
  const result = classifyError(new Error('something weird happened'));
  assert.strictEqual(result.category, ErrorCategory.UNKNOWN);
  assert.strictEqual(result.retryable, true);
});

test('uses Retry-After from message when available', () => {
  const result = classifyError(new Error('429 rate limit, retry after 45s'));
  assert.strictEqual(result.retryAfterMs, 45000);
  assert.strictEqual(result.cooldownMs, 45000);
});

test('accepts string input', () => {
  const result = classifyError('401 invalid api key');
  assert.strictEqual(result.category, ErrorCategory.AUTH_ERROR);
});

test('includes provider in result', () => {
  const result = classifyError(new Error('timeout'), 'groq');
  assert.strictEqual(result.provider, 'groq');
});

// --- P2 : HTTP 400 « modèle indisponible » vs vraie requête invalide ---
console.log('\nP2 — HTTP 400 : modèle indisponible vs requête invalide:');

test('400 + "Model ... is currently unavailable" → MODEL_UNAVAILABLE (fallback autorisé)', () => {
  const result = classifyError(new Error("LLM7 API error 400: Model 'nemotron-3-nano:30b' is currently unavailable."));
  assert.strictEqual(result.httpCode, 400);
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
  assert.strictEqual(result.retryable, true);
  assert.strictEqual(result.skipToNextKey, true);
});

test('400 + "model not found" → MODEL_UNAVAILABLE', () => {
  const result = classifyError(new Error('400 model not found'));
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
});

test('400 + "Model does not exist" → MODEL_UNAVAILABLE', () => {
  const result = classifyError(new Error('API error 400: Model does not exist on this provider'));
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
});

test('400 + "Provider model unavailable" → MODEL_UNAVAILABLE', () => {
  const result = classifyError('400 Provider model unavailable');
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
});

test('400 + invalid parameter → INVALID_REQUEST (aucun fallback)', () => {
  const result = classifyError(new Error('400 Bad Request: invalid parameter "temperature"'));
  assert.strictEqual(result.category, ErrorCategory.INVALID_REQUEST);
  assert.strictEqual(result.retryable, false);
  assert.strictEqual(result.skipToNextKey, false);
});

test('400 + malformed JSON → INVALID_REQUEST', () => {
  const result = classifyError(new Error('400 Bad Request: malformed JSON body'));
  assert.strictEqual(result.category, ErrorCategory.INVALID_REQUEST);
  assert.strictEqual(result.retryable, false);
});

test('400 + "is not a valid model ID" (OpenRouter) → MODEL_UNAVAILABLE', () => {
  const result = classifyError(new Error("400 OpenRouter API error: 'foo/bar:free' is not a valid model ID"));
  assert.strictEqual(result.httpCode, 400);
  assert.strictEqual(result.category, ErrorCategory.MODEL_UNAVAILABLE);
  assert.strictEqual(result.retryable, true);
});

test('MODEL_UNAVAILABLE → décision fallback ; INVALID_REQUEST → décision fail', () => {
  const stateA = new RetryState({ maxRetries: 4 });
  const a = stateA.recordAttempt(new Error('400 Model is unavailable'), 'kilo', 'k1');
  assert.strictEqual(a.action, 'fallback');

  const stateB = new RetryState({ maxRetries: 4 });
  const b = stateB.recordAttempt(new Error('400 invalid parameter "temperature"'), 'kilo', 'k1');
  assert.strictEqual(b.action, 'fail');
});

test('looksLikeModelUnavailable distingue les deux messages', () => {
  assert.strictEqual(looksLikeModelUnavailable("Model 'x' is currently unavailable."), true);
  assert.strictEqual(looksLikeModelUnavailable('invalid parameter: temperature'), false);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
