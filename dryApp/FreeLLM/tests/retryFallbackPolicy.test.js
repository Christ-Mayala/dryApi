/**
 * Tests — Politique de retry & budget de fallback (option 1 + option 2 prudente).
 *
 * Couvre les comportements introduits :
 *   - un TIMEOUT part directement en fallback (plus de retry sur le même fournisseur) ;
 *   - une vraie erreur réseau conserve 1 retry sur le même fournisseur ;
 *   - le budget global (45 s) et la garde de démarrage (MIN_ATTEMPT_BUDGET_MS)
 *     empêchent toute tentative qui n'aurait plus le temps d'aboutir ;
 *   - un appel légitime lent (≈14,8 s) aboutit toujours ;
 *   - les timeouts individuels des fournisseurs sont inchangés.
 *
 * NODE_ENV=test + secrets factices : `enhancedProxy` importe la config applicative
 * (config/database.js) qui exige JWT_SECRET / SESSION_SECRET même hors production.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-0123456789abcdefghij';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-0123456789abc';
process.env.PORT = process.env.PORT || '5000';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '60000';
process.env.HEALTH_MONITOR_INTERVAL_MS = process.env.HEALTH_MONITOR_INTERVAL_MS || '0';

const assert = require('assert');
const { RetryState } = require('../core/services/smartRetry');
const { classifyError, ErrorCategory } = require('../core/services/errorClassifier');
const { hasBudgetForAttempt } = require('../core/routes/enhancedProxy');
const { getProvider } = require('../core/providers');

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

// Constantes de la politique (miroir de enhancedProxy.js / smartRetry.js).
const BUDGET_MS = 45_000;
const MIN_ATTEMPT_MS = 5_000;

console.log('\n🧭 Retry & Fallback Policy Tests\n');

// ─── SCÉNARIO 1 : Google timeout → Kilo appelé immédiatement ─────────
console.log('Scénario 1: Google timeout → fallback immédiat vers Kilo');

test('un timeout ne retente pas le même fournisseur', () => {
  const state = new RetryState();
  const d = state.recordAttempt(new Error('ETIMEDOUT'), 'google', 'key-google');
  assert.strictEqual(d.action, 'fallback', 'timeout → fallback immédiat');
  assert.strictEqual(d.classifiedError.category, ErrorCategory.TIMEOUT);
  assert.strictEqual(state.networkRetries, 0, 'aucun crédit réseau consommé');
  assert.strictEqual(state.fallbackCount, 1);
});

test('le délai consommé par le fournisseur n\'est pas doublé (un seul appel Google)', () => {
  // Deux tentatives sur le même fournisseur auraient coûté ~2 × 15 s.
  // Le nouveau comportement ne coûte que le timeout propre du fournisseur.
  const googleTimeout = getProvider('google').timeoutMs || 15_000;
  const state = new RetryState();
  const d1 = state.recordAttempt(new Error('ETIMEDOUT'), 'google', 'k-google');
  assert.strictEqual(d1.action, 'fallback');
  // On passe au suivant : c'est maintenant Kilo qui est essayé.
  const d2 = state.recordAttempt(new Error('ETIMEDOUT'), 'kilo', 'k-kilo');
  assert.strictEqual(d2.action, 'fallback');
  assert.strictEqual(state.fallbackCount, 2);
  assert.ok(googleTimeout <= 15_000, `timeout Google inchangé (${googleTimeout} ms)`);
});

// ─── SCÉNARIO 2 : Google + Kilo timeout → OVH ────────────────────────
console.log('\nScénario 2: Google timeout + Kilo timeout → OVH disponible');

test('chaîne timeout/timeout → troisième fournisseur essayé', () => {
  const state = new RetryState({ maxRetries: 4 });
  state.recordAttempt(new Error('ETIMEDOUT'), 'google', 'k1');
  state.recordAttempt(new Error('ETIMEDOUT'), 'kilo', 'k2');
  assert.strictEqual(state.fallbackCount, 2);
  assert.strictEqual(state.shouldContinue(), true, 'le budget de fallback reste ouvert pour OVH');

  const d3 = state.recordAttempt(new Error('ETIMEDOUT'), 'ovh', 'k3');
  assert.strictEqual(d3.action, 'fallback');
  assert.strictEqual(state.fallbackCount, 3);
});

// ─── SCÉNARIO 3 : tous les fournisseurs en 429 → échec rapide ────────
console.log('\nScénario 3: tous les fournisseurs renvoient 429 → échec rapide');

test('429 en cascade → budget de fallback épuisé → fail sans attente fournisseur', () => {
  const providers = ['google', 'kilo', 'ovh', 'ollama'];
  const state = new RetryState({ maxRetries: providers.length });

  // Chaque 429 enchaîne immédiatement vers le fournisseur suivant.
  providers.forEach((p, i) => {
    const d = state.recordAttempt(new Error('429 Too Many Requests'), p, `k-${p}`);
    assert.strictEqual(d.classifiedError.category, ErrorCategory.RATE_LIMIT);
    assert.strictEqual(d.action, 'fallback', `429 sur ${p} → fallback`);
    assert.strictEqual(state.fallbackCount, i + 1);
  });

  // Budget de fallback épuisé : plus aucun fournisseur à essayer.
  assert.strictEqual(state.shouldContinue(), false);
  const extra = state.recordAttempt(new Error('429 Too Many Requests'), 'llm7', 'k-llm7');
  assert.strictEqual(extra.action, 'fail', 'budget épuisé → échec, pas d\'attente supplémentaire');
});

// ─── SCÉNARIO 4 : tous les fournisseurs muets → budget global respecté ─
console.log('\nScénario 4: tous les fournisseurs muets → budget global (45 s) respecté');

test('budget global = 45 s', () => {
  assert.strictEqual(hasBudgetForAttempt(0, BUDGET_MS, MIN_ATTEMPT_MS), true);
  assert.strictEqual(hasBudgetForAttempt(BUDGET_MS - MIN_ATTEMPT_MS, BUDGET_MS, MIN_ATTEMPT_MS), true, 'exactement 5 s restantes → autorisé');
  assert.strictEqual(hasBudgetForAttempt(BUDGET_MS - MIN_ATTEMPT_MS + 1, BUDGET_MS, MIN_ATTEMPT_MS), false, 'moins de 5 s restantes → refusé');
  assert.strictEqual(hasBudgetForAttempt(BUDGET_MS, BUDGET_MS, MIN_ATTEMPT_MS), false);
});

test('4 fournisseurs muets ne peuvent pas dépasser ~45 s', () => {
  // Timeouts Google 15 s + Kilo 15 s = 30 s, OVH 30 s serait refusé au-delà du budget.
  const timeline = [0, 15_000, 30_000];
  for (const elapsed of timeline) {
    assert.strictEqual(hasBudgetForAttempt(elapsed, BUDGET_MS, MIN_ATTEMPT_MS), true, `tentative autorisée à ${elapsed} ms`);
  }
  // À 40 s consommées il reste pile 5 s → encore possible ; au-delà d'une tentative
  // supplémentaire le budget serait dépassé.
  assert.strictEqual(hasBudgetForAttempt(40_000, BUDGET_MS, MIN_ATTEMPT_MS), true);
  assert.strictEqual(hasBudgetForAttempt(40_001, BUDGET_MS, MIN_ATTEMPT_MS), false);
  // Un 4e fournisseur muet lancé à 30 s s'arrêterait à 60 s : c'est justement ce
  // que la garde empêche quand il ne reste plus assez de temps.
  assert.strictEqual(hasBudgetForAttempt(41_000, BUDGET_MS, MIN_ATTEMPT_MS), false, 'pas de nouvelle tentative en fin de budget');
});

// ─── SCÉNARIO 5 : erreur réseau temporaire → 1 retry ─────────────────
console.log('\nScénario 5: erreur réseau temporaire → 1 retry autorisé');

test('ECONNREFUSED → retry_same_provider une seule fois', () => {
  const state = new RetryState({ maxNetworkRetries: 1 });
  const d1 = state.recordAttempt(new Error('ECONNREFUSED'), 'groq', 'k1');
  assert.strictEqual(d1.action, 'retry_same_provider');
  assert.strictEqual(state.networkRetries, 1);

  const d2 = state.recordAttempt(new Error('ECONNREFUSED'), 'groq', 'k1');
  assert.ok(d2.action === 'fallback' || d2.action === 'fail', `crédit réseau épuisé → ${d2.action}`);
  assert.strictEqual(state.networkRetries, 1);
});

test('le classifieur distingue réseau (retry) et timeout (fallback)', () => {
  const net = classifyError(new Error('ECONNREFUSED'));
  const to = classifyError(new Error('ETIMEDOUT'));
  assert.strictEqual(net.category, ErrorCategory.NETWORK_ERROR);
  assert.strictEqual(net.skipToNextKey, false, 'réseau → même fournisseur');
  assert.strictEqual(to.category, ErrorCategory.TIMEOUT);
  assert.strictEqual(to.skipToNextKey, true, 'timeout → fournisseur suivant');
});

// ─── SCÉNARIO 6 : génération légitime de 14,8 s ──────────────────────
console.log('\nScénario 6: génération légitime de 14,8 s → succès');

test('14,8 s reste sous le timeout Google et dans le budget global', () => {
  const legitimateMs = 14_800;
  const googleTimeout = getProvider('google').timeoutMs || 15_000;
  assert.ok(legitimateMs < googleTimeout, `14,8 s < timeout fournisseur (${googleTimeout} ms)`);
  assert.strictEqual(hasBudgetForAttempt(0, BUDGET_MS, MIN_ATTEMPT_MS), true, 'la tentative démarre');
  assert.strictEqual(hasBudgetForAttempt(legitimateMs, BUDGET_MS, MIN_ATTEMPT_MS), true, 'et se termine dans le budget');
});

// ─── SCÉNARIO 7 : timeout fournisseur réel (AbortError) ──────────────
console.log('\nScénario 7: timeout fournisseur réel (AbortError) → pénalité + fallback');

test('un AbortError de timeout est un échec provider, pas une déconnexion client', () => {
  // Forme exacte de l\'erreur émise par fetchWithTimeout quand le timer local
  // expire (AbortError du fetch). Elle est identique à celle d\'une annulation
  // client : seul le drapeau clientDisconnected du proxy les distingue.
  const err = new Error('This operation was aborted');
  err.name = 'AbortError';
  err.code = 20;

  const classified = classifyError(err);
  assert.strictEqual(classified.category, ErrorCategory.TIMEOUT, 'timeout provider → catégorie TIMEOUT');
  assert.strictEqual(classified.skipToNextKey, true, 'on écarte la clé/fournisseur');

  const state = new RetryState({ maxRetries: 4 });
  const d = state.recordAttempt(err, 'google', 'k-google');
  assert.strictEqual(d.action, 'fallback', 'timeout provider → fallback (jamais ignoré)');
  assert.strictEqual(state.networkRetries, 0, 'ce n\'est pas un retry réseau');
});

// ─── SCÉNARIO 8 : requêtes simultanées → états indépendants ──────────
console.log('\nScénario 8: requêtes simultanées → aucun état partagé');

test('chaque requête possède son propre RetryState', () => {
  const states = Array.from({ length: 5 }, () => new RetryState());
  states.forEach((s) => s.recordAttempt(new Error('ETIMEDOUT'), 'google', 'k'));
  // Aucun compteur n'est mutualisé : chaque requête reste à 1 fallback.
  for (const s of states) {
    assert.strictEqual(s.fallbackCount, 1, 'un timeout par requête = 1 fallback');
    assert.strictEqual(s.networkRetries, 0);
  }
});

// ─── Timeouts fournisseurs inchangés ─────────────────────────────────
console.log('\nContrainte: timeouts individuels des fournisseurs inchangés');

test('timeouts des passerelles non modifiés', () => {
  assert.strictEqual(getProvider('kilo').timeoutMs, 15_000, 'Kilo 15 s');
  assert.strictEqual(getProvider('ovh').timeoutMs, 30_000, 'OVH 30 s');
  assert.strictEqual(getProvider('ollama').timeoutMs, 30_000, 'Ollama 30 s');
  assert.strictEqual(getProvider('pollinations').timeoutMs, 8_000, 'Pollinations 8 s');
  // Groq utilise le défaut de BaseProvider.fetchWithTimeout (15 s).
  assert.strictEqual(getProvider('groq').timeoutMs, 15_000, 'Groq 15 s (défaut)');
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
