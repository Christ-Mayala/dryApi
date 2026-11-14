const crypto = require('crypto');

/**
 * Combine plusieurs `AbortSignal` en un seul : le signal résultant est abandonné
 * dès que l'un des signaux sources l'est. Utilisé pour superposer l'annulation
 * externe (déconnexion client) au timer propre au provider.
 */
function combineSignals(signals) {
  const actifs = (signals || []).filter(Boolean);
  if (actifs.length === 0) return undefined;
  if (actifs.length === 1) return actifs[0];
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(actifs);
  }
  const controller = new AbortController();
  const aborter = () => controller.abort();
  for (const signal of actifs) {
    if (signal.aborted) { controller.abort(); break; }
    signal.addEventListener('abort', aborter, { once: true });
  }
  return controller.signal;
}

class BaseProvider {
  get platform() {
    throw new Error('platform must be implemented');
  }

  get name() {
    throw new Error('name must be implemented');
  }

  async chatCompletion(apiKey, messages, modelId, options) {
    throw new Error('chatCompletion must be implemented');
  }

  async *streamChatCompletion(apiKey, messages, modelId, options) {
    throw new Error('streamChatCompletion must be implemented');
  }

  async validateKey(apiKey) {
    return true;
  }

  /**
   * `fetch` protégé par un timeout.
   *
   * Le timer borne l'obtention des en-têtes (comportement historique : il est
   * libéré dès que `fetch` résout, donc il ne couvre pas la lecture du corps).
   * `init.signal` permet en plus d'annuler l'appel — en-têtes ET lecture du
   * corps — depuis l'extérieur, par exemple quand le client ferme la connexion.
   */
  async fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signal = combineSignals([controller.signal, init.signal]);
    try {
      return await fetch(url, { ...init, signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  makeId() {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

module.exports = { BaseProvider };
