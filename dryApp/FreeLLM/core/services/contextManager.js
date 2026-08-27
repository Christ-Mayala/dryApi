/**
 * Context Manager — Gestion intelligente du contexte conversationnel.
 *
 * Améliorations :
 * - Priority layers (CRITICAL → HIGH → NORMAL → LOW → DISCARDABLE)
 * - Protected content (system instructions, tool schemas jamais compressés)
 * - Deduplication intelligente
 * - Safe compression (jamais les instructions critiques)
 * - Tool-safe mode (préserve les paires assistant/tool_call)
 * - Metrics de compression
 *
 * backward-compat : manageContext() et anciens exports conservés.
 */

const { estimateTotalTokens, compressContext } = require('./tokenEstimator.js');

// ═══ Priority System ═════════════════════════════════════════
const Priority = {
  CRITICAL: 0,   // System instructions, tool schemas, security policies
  HIGH: 1,       // Recent user messages, active task, tool calls
  NORMAL: 2,     // Working memory, recent conversation
  LOW: 3,        // Old messages, summaries
  DISCARDABLE: 4, // Greetings, filler, repeated content
};

function extractText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.filter(p => p.type === 'text').map(p => p.text).join(' ');
  }
  return '';
}

function classifyMessagePriority(message) {
  if (!message) return Priority.DISCARDABLE;
  if (message.role === 'system') return Priority.CRITICAL;
  if (message.role === 'tool') return Priority.HIGH;
  if (message.tool_calls?.length > 0) return Priority.HIGH;
  if (message.role === 'assistant') {
    return extractText(message).length > 50 ? Priority.HIGH : Priority.NORMAL;
  }
  if (message.role === 'user') {
    const text = extractText(message);
    if (text.length < 10) return Priority.DISCARDABLE;
    if (/^(hi|hello|hey|salut|bonjour|ok|yes|no|oui|non)\s*$/i.test(text)) return Priority.DISCARDABLE;
    return Priority.HIGH;
  }
  return Priority.NORMAL;
}

function isProtected(message) {
  if (!message || message.role !== 'system') return false;
  const text = extractText(message).toLowerCase();
  return ['security', 'instruction', 'policy', 'constraint', 'rule',
    'must not', 'do not', 'never', 'always', 'json schema', 'tool', 'function', 'api'
  ].some(p => text.includes(p));
}

function deduplicateMessages(messages) {
  const seen = new Set();
  return messages.filter(msg => {
    const text = extractText(msg).toLowerCase().trim().slice(0, 100);
    if (text && seen.has(text) && msg.role !== 'tool') return false;
    if (text) seen.add(text);
    return true;
  });
}

// ═══ Tool-Safe Context ══════════════════════════════════════
function manageToolSafeContext(messages, maxTokens = 16000) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Build tool pairs (assistant tool_call + tool response)
  const chunks = [];
  let i = 0;
  while (i < nonSystem.length) {
    const msg = nonSystem[i];
    if (msg.role === 'assistant' && msg.tool_calls?.length > 0 && i + 1 < nonSystem.length && nonSystem[i + 1].role === 'tool') {
      chunks.push([msg, nonSystem[i + 1]]);
      i += 2;
    } else {
      chunks.push([msg]);
      i++;
    }
  }

  const result = [...systemMessages];
  let tokens = estimateTotalTokens(result);

  // Add chunks from most recent to oldest
  for (let j = chunks.length - 1; j >= 0; j--) {
    const chunkTokens = estimateTotalTokens(chunks[j]);
    if (tokens + chunkTokens <= maxTokens) {
      result.push(...chunks[j]);
      tokens += chunkTokens;
    }
  }

  // Compress oldest if still over budget
  while (tokens > maxTokens && result.length > 4) {
    // Find first non-system, non-tool message to compress
    for (let k = systemMessages.length; k < result.length; k++) {
      if (result[k].role === 'system' || result[k].role === 'tool') continue;
      const content = extractText(result[k]);
      if (content.length > 200) {
        result[k] = { ...result[k], content: content.slice(0, 100) + '... [compressed]' };
        tokens = estimateTotalTokens(result);
        break;
      }
    }
    break; // Safety: don't loop forever
  }

  return result;
}

// ═══ Main API ════════════════════════════════════════════════

function manageContext(messages, maxTokens = 8000, hasTools = false) {
  const start = Date.now();
  const originalTokens = estimateTotalTokens(messages);

  // Tool-safe mode
  if (hasTools) {
    const result = manageToolSafeContext(messages, maxTokens);
    const finalTokens = estimateTotalTokens(result);
    const tokensSaved = originalTokens - finalTokens;
    return {
      messages: result,
      compressed: tokensSaved > 0,
      compressionRatio: originalTokens > 0 ? tokensSaved / originalTokens : 0,
      tokensSaved,
      originalTokens,
      finalTokens,
      duration: Date.now() - start,
    };
  }

  // No compression needed
  if (originalTokens <= maxTokens) {
    return {
      messages, compressed: false, compressionRatio: 0, tokensSaved: 0,
      originalTokens, finalTokens: originalTokens, duration: Date.now() - start,
    };
  }

  // Priority-based compression
  const classified = messages.map((msg, idx) => ({
    message: msg,
    priority: classifyMessagePriority(msg),
    protected: isProtected(msg),
    tokens: estimateTotalTokens([msg]),
    index: idx,
  }));

  const protectedMessages = classified.filter(m => m.protected);
  const unprotected = classified.filter(m => !m.protected);

  // Always keep protected
  const kept = [...protectedMessages];
  let currentTokens = kept.reduce((sum, m) => sum + m.tokens, 0);

  // Sort unprotected by priority then recency
  unprotected.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : b.index - a.index);

  for (const item of unprotected) {
    if (currentTokens + item.tokens <= maxTokens) {
      kept.push(item);
      currentTokens += item.tokens;
    }
  }

  // Sort by original order
  kept.sort((a, b) => a.index - b.index);

  let finalMessages = kept.map(m => m.message);
  let finalTokens = estimateTotalTokens(finalMessages);

  // Compress oldest non-system messages if still over budget
  if (finalTokens > maxTokens) {
    finalMessages = compressOldestMessages(finalMessages, maxTokens * 0.9);
    finalTokens = estimateTotalTokens(finalMessages);
  }

  const tokensSaved = originalTokens - finalTokens;

  return {
    messages: finalMessages,
    compressed: tokensSaved > 0,
    compressionRatio: originalTokens > 0 ? tokensSaved / originalTokens : 0,
    tokensSaved,
    originalTokens,
    finalTokens,
    duration: Date.now() - start,
  };
}

function compressOldestMessages(messages, targetTokens) {
  const result = [...messages];
  let currentTokens = estimateTotalTokens(result);
  for (let i = 0; i < result.length && currentTokens > targetTokens; i++) {
    if (result[i].role === 'system') continue;
    const content = extractText(result[i]);
    if (content.length > 200) {
      result[i] = { ...result[i], content: content.slice(0, 100) + '... [compressed]' };
      currentTokens = estimateTotalTokens(result);
    }
  }
  return result;
}

// ═══ Legacy Exports (backward compat) ═══════════════════════
const conversationMemories = new Map();
const MEMORY_TTL_MS = 3600000;

function getConversationKey(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return null;
  const content = typeof firstUser.content === 'string' ? firstUser.content.slice(0, 200) : JSON.stringify(firstUser.content).slice(0, 200);
  return require('crypto').createHash('sha256').update(content).digest('hex');
}

function getConversationMemory(key) {
  if (!key) return null;
  const m = conversationMemories.get(key);
  if (!m) return null;
  if (Date.now() - m.lastUpdated > MEMORY_TTL_MS) { conversationMemories.delete(key); return null; }
  return m;
}

function updateConversationMemory(key, summary, recentMessages) {
  if (!key) return;
  conversationMemories.set(key, { summary, recentMessages, lastUpdated: Date.now() });
}

function createConversationSummary(messages) {
  if (messages.length <= 4) return null;
  const parts = [];
  for (let i = 0; i < messages.length - 4; i++) {
    const msg = messages[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      const content = extractText(msg);
      if (content.length > 100) parts.push(`${msg.role.toUpperCase()}: ${content.slice(0, 150)}...`);
    }
  }
  return parts.length > 0 ? `[SUMMARY]\n${parts.join('\n')}\n[END]` : null;
}

function pruneNonEssentialMessages(messages) {
  return messages.filter(msg => {
    const content = extractText(msg).trim();
    if (content.length < 10) return false;
    if (/^(ok|thanks)\s*$/i.test(content)) return false;
    return true;
  });
}

module.exports = {
  // Priority system
  Priority,
  classifyMessagePriority,
  isProtected,
  deduplicateMessages,
  extractText,
  // Main API
  manageContext,
  manageToolSafeContext,
  // Legacy
  createConversationSummary,
  pruneNonEssentialMessages,
  getConversationKey,
  getConversationMemory,
  updateConversationMemory,
};
