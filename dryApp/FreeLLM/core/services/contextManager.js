const { estimateTotalTokens, compressContext } = require('./tokenEstimator.js');

const conversationMemories = new Map();
const MEMORY_TTL_MS = 3600000;

// Context Layering: Core Identity Layer - system prompt and constraints
function getCoreIdentityLayer(messages) {
  const systemMessages = messages.filter(m => m.role === 'system');
  return systemMessages.length > 0 ? [...systemMessages] : [];
}

// Context Layering: Active Task State - last task, tool calls, recent results
function getActiveTaskStateLayer(messages) {
  const taskLayer = [];
  
  // Look for last tool calls and responses
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.tool_calls) {
      // Add this tool call
      taskLayer.unshift(msg);
      // Look for corresponding tool response
      if (i + 1 < messages.length && messages[i + 1].role === 'tool') {
        taskLayer.push(messages[i + 1]);
      }
      // Stop after finding one set of tool interactions
      break;
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      // Add the last 1-2 non-tool messages as active task
      taskLayer.unshift(msg);
      if (taskLayer.length >= 2) break;
    }
  }
  
  return taskLayer;
}

// Context Layering: Working Memory - recent useful messages
function getWorkingMemoryLayer(messages, maxCount = 6) {
  const workingLayer = [];
  
  // Iterate from the end, preserving tool pairs
  let i = messages.length - 1;
  while (i >= 0 && workingLayer.length < maxCount) {
    const msg = messages[i];
    if (msg.role === 'tool') {
      // Tool message, check for corresponding assistant message before it
      if (i - 1 >= 0 && messages[i - 1].role === 'assistant' && messages[i - 1].tool_calls) {
        workingLayer.unshift(messages[i - 1]);
        workingLayer.unshift(msg);
        i -= 2;
      } else {
        workingLayer.unshift(msg);
        i -= 1;
      }
    } else {
      workingLayer.unshift(msg);
      i -= 1;
    }
  }
  
  return workingLayer;
}

// Context Layering: Archived Memory - summary of older messages
function createArchivedMemorySummary(messages, cutoffIndex) {
  if (cutoffIndex <= 0) return null;

  const summaryParts = [];

  for (let i = 0; i < cutoffIndex; i++) {
    const msg = messages[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.filter(p => p.type === 'text').map(p => p.text).join(' ');
      }

      if (content.length > 50) {
        summaryParts.push(`${msg.role.toUpperCase()}: ${content.slice(0, 100)}...`);
      }
    }
  }

  if (summaryParts.length === 0) return null;

  return `[ARCHIVED CONVERSATION SUMMARY]\n${summaryParts.slice(-10).join('\n')}\n[END ARCHIVED SUMMARY]`;
}

function getConversationKey(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return null;

  let content = '';
  if (typeof firstUser.content === 'string') {
    content = firstUser.content.slice(0, 200);
  } else if (Array.isArray(firstUser.content)) {
    content = JSON.stringify(firstUser.content).slice(0, 200);
  }

  return require('crypto').createHash('sha256').update(content).digest('hex');
}

function getConversationMemory(conversationKey) {
  if (!conversationKey) return null;

  const memory = conversationMemories.get(conversationKey);
  if (!memory) return null;

  if (Date.now() - memory.lastUpdated > MEMORY_TTL_MS) {
    conversationMemories.delete(conversationKey);
    return null;
  }

  return memory;
}

function updateConversationMemory(conversationKey, summary, recentMessages) {
  if (!conversationKey) return;

  conversationMemories.set(conversationKey, {
    summary,
    recentMessages,
    lastUpdated: Date.now()
  });
}

function createConversationSummary(messages) {
  if (messages.length <= 4) return null;

  const summaryParts = [];

  for (let i = 0; i < messages.length - 4; i++) {
    const msg = messages[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.filter(p => p.type === 'text').map(p => p.text).join(' ');
      }

      if (content.length > 100) {
        summaryParts.push(`${msg.role.toUpperCase()}: ${content.slice(0, 150)}...`);
      }
    }
  }

  if (summaryParts.length === 0) return null;

  return `[CONVERSATION SUMMARY]\n${summaryParts.join('\n')}\n[END SUMMARY]`;
}

function manageToolSafeContext(messages, maxTokens = 16000) {
  const start = Date.now();
  const originalTokens = estimateTotalTokens(messages);

  const conversationKey = getConversationKey(messages);
  let finalMessages = [];

  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  if (systemMessage) {
    finalMessages.push(systemMessage);
  }

  const messageChunks = [];
  let i = systemMessage ? 1 : 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      let toolResponse = null;
      if (i + 1 < messages.length && messages[i + 1].role === 'tool') {
        toolResponse = messages[i + 1];
      }

      if (toolResponse) {
        messageChunks.push({
          type: 'tool-pair',
          messages: [msg, toolResponse]
        });
        i += 2;
      } else {
        messageChunks.push({
          type: 'single',
          messages: [msg]
        });
        i++;
      }
    } else if (msg.role === 'tool') {
      messageChunks.push({
        type: 'single',
        messages: [msg]
      });
      i++;
    } else {
      messageChunks.push({
        type: 'single',
        messages: [msg]
      });
      i++;
    }
  }

  let recentChunkCount = 12;
  let selectedChunks = messageChunks.slice(-recentChunkCount);
  let finalTokens = 0;

  for (const chunk of selectedChunks) {
    finalMessages.push(...chunk.messages);
  }

  finalTokens = estimateTotalTokens(finalMessages);

  while (finalTokens > maxTokens && selectedChunks.length > 4) {
    recentChunkCount--;
    selectedChunks = messageChunks.slice(-recentChunkCount);

    finalMessages = [];
    if (systemMessage) finalMessages.push(systemMessage);
    for (const chunk of selectedChunks) {
      finalMessages.push(...chunk.messages);
    }
    finalTokens = estimateTotalTokens(finalMessages);
  }

  if (finalTokens > maxTokens) {
    const recentChunks = messageChunks.slice(-4);
    finalMessages = [];

    if (systemMessage) finalMessages.push(systemMessage);
    finalMessages.push({
      role: 'system',
      content: '[CONVERSATION SUMMARY: Older messages omitted to preserve tool sequence integrity]'
    });

    for (const chunk of recentChunks) {
      finalMessages.push(...chunk.messages);
    }
    finalTokens = estimateTotalTokens(finalMessages);
  }

  const tokensSaved = originalTokens - finalTokens;
  const compressionRatio = 1 - (finalTokens / originalTokens);
  const duration = Date.now() - start;

  console.log(`[ContextManager] ToolSafeContext: ${(compressionRatio * 100).toFixed(1)}% reduction | ${tokensSaved} tokens saved | ${duration}ms`);

  return {
    messages: finalMessages,
    compressed: tokensSaved > 0,
    compressionRatio,
    tokensSaved,
    originalTokens,
    finalTokens,
    isToolSafeMode: true,
    duration
  };
}

function manageContext(messages, maxTokens = 8000, hasTools = false) {
  if (hasTools) {
    return manageToolSafeContext(messages, maxTokens);
  }

  const start = Date.now();
  const originalTokens = estimateTotalTokens(messages);
  const conversationKey = getConversationKey(messages);
  const existingMemory = getConversationMemory(conversationKey);

  if (originalTokens <= maxTokens) {
    const duration = Date.now() - start;
    console.log(`[ContextManager] No compression needed: ${originalTokens} tokens | ${duration}ms`);
    return {
      messages,
      compressed: false,
      compressionRatio: 0,
      tokensSaved: 0,
      originalTokens,
      finalTokens: originalTokens,
      duration
    };
  }

  // Context Layering: Build the context layer by layer
  let finalMessages = [];
  
  // Layer 1: Core Identity (system prompts)
  const coreIdentity = getCoreIdentityLayer(messages);
  finalMessages.push(...coreIdentity);
  
  // Layer 2: Archived Memory (summary of older messages)
  const cutoffIndex = Math.max(0, messages.length - 20);
  const archivedSummary = createArchivedMemorySummary(messages, cutoffIndex);
  if (archivedSummary) {
    finalMessages.push({
      role: 'system',
      content: archivedSummary
    });
  }
  
  // Layer 3: Working Memory (recent messages)
  const workingMemory = getWorkingMemoryLayer(messages.slice(cutoffIndex), 10);
  finalMessages.push(...workingMemory);
  
  // Layer 4: Active Task State (last task/tool interactions)
  const activeTaskState = getActiveTaskStateLayer(messages);
  // Avoid duplicating messages that are already in working memory
  const activeTaskIds = new Set(activeTaskState.map(m => JSON.stringify(m)));
  const workingMemoryIds = new Set(workingMemory.map(m => JSON.stringify(m)));
  for (const msg of activeTaskState) {
    if (!workingMemoryIds.has(JSON.stringify(msg))) {
      finalMessages.push(msg);
    }
  }

  let finalTokens = estimateTotalTokens(finalMessages);
  
  // If still over token limit, compress more aggressively
  if (finalTokens > maxTokens) {
    const compressed = compressContext(finalMessages, maxTokens * 0.9);
    finalMessages = compressed.messages;
    finalTokens = compressed.compressedTokens;
  }

  const tokensSaved = originalTokens - finalTokens;
  const compressionRatio = 1 - (finalTokens / originalTokens);
  const duration = Date.now() - start;

  if (conversationKey && finalMessages.length > 4) {
    const newSummary = createConversationSummary(finalMessages);
    updateConversationMemory(conversationKey, newSummary, finalMessages.slice(-4));
  }

  console.log(`[ContextManager] Compressed with Context Layering: ${(compressionRatio * 100).toFixed(1)}% reduction | ${tokensSaved} tokens saved | ${duration}ms`);

  return {
    messages: finalMessages,
    compressed: true,
    compressionRatio,
    tokensSaved,
    originalTokens,
    finalTokens,
    duration
  };
}

function pruneNonEssentialMessages(messages) {
  return messages.filter(msg => {
    if (!msg.content) return false;

    let content = '';
    if (typeof msg.content === 'string') {
      content = msg.content.trim();
    } else if (Array.isArray(msg.content)) {
      content = msg.content.filter(p => p.type === 'text').map(p => p.text).join(' ').trim();
    }

    if (content.length < 10) return false;
    if (content.toLowerCase().includes('ok') && content.length < 20) return false;
    if (content.toLowerCase().includes('thanks') && content.length < 30) return false;

    return true;
  });
}

module.exports = {
  manageContext,
  createConversationSummary,
  pruneNonEssentialMessages,
  getConversationKey,
  getConversationMemory,
  updateConversationMemory,
  // Context Layering exports
  getCoreIdentityLayer,
  getActiveTaskStateLayer,
  getWorkingMemoryLayer,
  createArchivedMemorySummary
};

