/**
 * Streaming Recovery — Gère les interruptions de stream en milieu de réponse.
 *
 * Scénarios :
 *   1. Provider disconnect au milieu → état partiel sauvegardé
 *   2. Timeout pendant le streaming → réponse partielle available
 *   3. Provider A échoue en milieu de stream → tentative sur B
 *   4. Aucun provider ne peut compléter → renvoyer la réponse partielle
 *
 * Ne fait JAMAIS de retry aveugle — conserve l'état pour éviter les doublons.
 */

const { logger } = require('./inferenceLogger');

/**
 * @typedef {Object} StreamState
 * @property {string} requestId
 * @property {string} provider
 * @property {string} modelId
 * @property {string[]} chunks - Chunks reçus jusqu'ici
 * @property {string} accumulatedText - Texte accumulé
 * @property {number} totalOutputTokens - Tokens de sortie estimés
 * @property {number} startedAt - Timestamp de début
 * @property {number} lastChunkAt - Timestamp du dernier chunk
 * @property {boolean} completed - Si le stream est terminé normalement
 * @property {boolean} interrupted - Si le stream a été interrompu
 * @property {string|null} error - Message d'erreur si interrompu
 */

class StreamTracker {
  constructor(requestId) {
    this.requestId = requestId;
    this.provider = null;
    this.modelId = null;
    this.chunks = [];
    this.accumulatedText = '';
    this.totalOutputTokens = 0;
    this.startedAt = Date.now();
    this.lastChunkAt = Date.now();
    this.completed = false;
    this.interrupted = false;
    this.error = null;
    this.chunkCount = 0;
    this.recoveryAttempted = false;
    this.sentChunkCount = 0; // tracks what client has received
  }

  /**
   * Record an incoming chunk.
   */
  addChunk(chunk) {
    const text = chunk.choices?.[0]?.delta?.content || '';
    if (text) {
      this.chunks.push(text);
      this.accumulatedText += text;
      this.totalOutputTokens += Math.ceil(text.length / 4);
    }
    this.lastChunkAt = Date.now();
    this.chunkCount++;
  }

  /**
   * Mark stream as completed normally.
   */
  markComplete() {
    this.completed = true;
    this.interrupted = false;
  }

  /**
   * Mark stream as interrupted with error.
   */
  markInterrupted(error) {
    this.interrupted = true;
    this.error = typeof error === 'string' ? error : error?.message || 'Unknown error';
  }

  /**
   * Get the partial response if stream was interrupted.
   */
  getPartialResponse() {
    if (!this.accumulatedText) return null;

    return {
      id: `chatcmpl-partial-${this.requestId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.modelId || 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: this.accumulatedText,
        },
        finish_reason: 'length', // indicates partial
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: this.totalOutputTokens,
        total_tokens: this.totalOutputTokens,
      },
      _partial: true,
      _interrupted: true,
      _provider: this.provider,
      _chunksReceived: this.chunkCount,
    };
  }

  /**
   * Get time since last chunk (for timeout detection).
   */
  getTimeSinceLastChunk() {
    return Date.now() - this.lastChunkAt;
  }

  /**
   * Get stream duration.
   */
  getDuration() {
    return Date.now() - this.startedAt;
  }

  /**
   * Get summary for logging.
   */
  getSummary() {
    return {
      requestId: this.requestId,
      provider: this.provider,
      modelId: this.modelId,
      chunks: this.chunkCount,
      tokens: this.totalOutputTokens,
      duration: this.getDuration(),
      completed: this.completed,
      interrupted: this.interrupted,
      textLength: this.accumulatedText.length,
    };
  }
}

/**
 * Manages active streams for timeout detection.
 */
class StreamManager {
  constructor() {
    this.activeStreams = new Map(); // requestId → StreamTracker
    this.completedStreams = []; // recent completed streams (for debugging)
    this.MAX_COMPLETED = 100;
  }

  /**
   * Start tracking a new stream.
   */
  startStream(requestId, provider, modelId) {
    const tracker = new StreamTracker(requestId);
    tracker.provider = provider;
    tracker.modelId = modelId;
    this.activeStreams.set(requestId, tracker);
    return tracker;
  }

  /**
   * Get tracker for a stream.
   */
  getTracker(requestId) {
    return this.activeStreams.get(requestId);
  }

  /**
   * Complete a stream (success or failure).
   */
  completeStream(requestId) {
    const tracker = this.activeStreams.get(requestId);
    if (tracker) {
      this.activeStreams.delete(requestId);
      this.completedStreams.push(tracker.getSummary());
      if (this.completedStreams.length > this.MAX_COMPLETED) {
        this.completedStreams.shift();
      }
    }
    return tracker;
  }

  /**
   * Check for timed-out streams (no chunk in X seconds).
   */
  getTimedOutStreams(timeoutMs = 30_000) {
    const timedOut = [];
    const now = Date.now();
    for (const [requestId, tracker] of this.activeStreams) {
      if (now - tracker.lastChunkAt > timeoutMs) {
        timedOut.push(tracker);
      }
    }
    return timedOut;
  }

  /**
   * Get stats for dashboard.
   */
  getStats() {
    return {
      active: this.activeStreams.size,
      completed: this.completedStreams.length,
      recent: this.completedStreams.slice(-10),
    };
  }

  /**
   * Check if a stream can be recovered.
   * Recovery is possible if:
   *   - We have partial content (chunks > 0)
   *   - The interruption was a network/timeout error (not auth)
   *   - We haven't already attempted recovery
   */
  canRecover(requestId) {
    const tracker = this.activeStreams.get(requestId);
    if (!tracker) return false;
    if (!tracker.interrupted) return false;
    if (tracker.recoveryAttempted) return false;
    // Can recover if we have partial content and error is retryable
    const retryableErrors = ['timeout', 'timedout', 'network_error', 'server_error', 'stream_error', 'econnreset', 'econnrefused'];
    return tracker.chunkCount > 0 && retryableErrors.some(e =>
      (tracker.error || '').toLowerCase().includes(e)
    );
  }

  /**
   * Mark recovery as attempted for a stream.
   */
  markRecoveryAttempted(requestId) {
    const tracker = this.activeStreams.get(requestId);
    if (tracker) tracker.recoveryAttempted = true;
  }

  /**
   * Send partial response to client (when recovery fails).
   * Returns the partial response object and closes the SSE stream.
   */
  sendPartialResponse(res, requestId) {
    const tracker = this.activeStreams.get(requestId);
    if (!tracker) return null;

    const partial = tracker.getPartialResponse();
    if (!partial) return null;

    try {
      // Send error indicator with partial content
      res.write('data: ' + JSON.stringify({
        error: {
          message: `Stream interrupted after ${tracker.chunkCount} chunks. Partial response available.`,
          type: 'stream_interrupted',
          _partial: true,
          _chunksReceived: tracker.chunkCount,
          _provider: tracker.provider,
        }
      }) + '\n\n');

      // Send the accumulated text as a final chunk
      if (tracker.accumulatedText) {
        res.write('data: ' + JSON.stringify({
          choices: [{
            delta: { content: '' },
            index: 0,
            finish_reason: 'stop',
          }],
        }) + '\n\n');
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch {}

    return partial;
  }

  /**
   * Get deduplication-safe content.
   * If we reconnect, we must NOT resend already-sent chunks.
   */
  getChunksToSend(requestId) {
    const tracker = this.activeStreams.get(requestId);
    if (!tracker) return [];
    // Return all chunks — caller decides what's already sent
    return tracker.chunks;
  }

  /**
   * Clean up old streams.
   */
  cleanup(maxAgeMs = 300000) {
    const now = Date.now();
    for (const [requestId, tracker] of this.activeStreams) {
      if (now - tracker.startedAt > maxAgeMs) {
        this.activeStreams.delete(requestId);
      }
    }
  }
}

// Singleton
const streamManager = new StreamManager();

module.exports = {
  StreamTracker,
  StreamManager,
  streamManager,
};
