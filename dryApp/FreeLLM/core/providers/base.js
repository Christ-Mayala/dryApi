const crypto = require('crypto');

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

  async fetchWithTimeout(url, init, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  makeId() {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

module.exports = { BaseProvider };
