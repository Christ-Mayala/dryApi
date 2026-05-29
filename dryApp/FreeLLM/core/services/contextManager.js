const { estimateTotalTokens, compressContext } = require('./tokenEstimator.js');

const conversationMemories = new Map();
const MEMORY_TTL_MS = 3600000; // 1 heure

function getConversationKey(messages) {
  // Hash des premiers messages pour identifier la conversation
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
  
  // Extract key points from older messages
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
  const conversationKey = getConversationKey(messages);
  const currentTokens = estimateTotalTokens(messages);
  
  let finalMessages = [];
  
  // 1. Keep system messages (at beginning)
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  if (systemMessage) {
    finalMessages.push(systemMessage);
  }
  
  // 2. Group messages into tool-safe chunks (preserve pairs)
  const messageChunks = [];
  let i = systemMessage ? 1 : 0;
  
  while (i < messages.length) {
    const msg = messages[i];
    
    // Check if this is an assistant message with tool_calls
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
  
  // 3. Keep recent chunks (preserve tool pairs - never split them!)
  // Try to keep last 10-12 chunks, adjust downward if needed
  let recentChunkCount = 12;
  let selectedChunks = messageChunks.slice(-recentChunkCount);
  
  // 4. Build final messages
  for (const chunk of selectedChunks) {
    finalMessages.push(...chunk.messages);
  }
  
  // 5. Check token limit, if still over reduce chunk count
  let finalTokens = estimateTotalTokens(finalMessages);
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
  
  // 6. If still over limit, compress but preserve tool pairs structure
  if (finalTokens > maxTokens) {
    // Keep last 4 tool pairs/chunks, create simple summary of older ones
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
  
  const tokensSaved = currentTokens - finalTokens;
  const compressionRatio = 1 - (finalTokens / currentTokens);
  
  return {
    messages: finalMessages,
    compressed: tokensSaved > 0,
    compressionRatio,
    tokensSaved,
    originalTokens: currentTokens,
    finalTokens,
    isToolSafeMode: true
  };
}

function manageContext(messages, maxTokens = 8000, hasTools = false) {
  if (hasTools) {
    return manageToolSafeContext(messages, maxTokens);
  }
  
  const conversationKey = getConversationKey(messages);
  const existingMemory = getConversationMemory(conversationKey);
  
  const currentTokens = estimateTotalTokens(messages);
  
  if (currentTokens <= maxTokens) {
    return {
      messages,
      compressed: false,
      compressionRatio: 0,
      tokensSaved: 0
    };
  }
  
  let summary = null;
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  
  if (existingMemory && existingMemory.summary) {
    summary = existingMemory.summary;
  } else if (messages.length > 6) {
    summary = createConversationSummary(messages);
  }
  
  const messageChunks = [];
  let i = 0;
  
  while (i < messages.length) {
    const msg = messages[i];
    if (i === 0 && msg.role === 'system') {
      i++;
      continue;
    }
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      let toolResponse = null;
      if (i + 1 < messages.length && messages[i + 1].role === 'tool') {
        toolResponse = messages[i + 1];
      }
      if (toolResponse) {
        messageChunks.push([msg, toolResponse]);
        i += 2;
      } else {
        messageChunks.push([msg]);
        i++;
      }
    } else if (msg.role === 'tool') {
      messageChunks.push([msg]);
      i++;
    } else {
      messageChunks.push([msg]);
      i++;
    }
  }
  
  const recentChunkCount = 6;
  const recentChunks = messageChunks.slice(-recentChunkCount);
  
  let finalMessages = [];
  if (systemMessage) finalMessages.push(systemMessage);
  if (summary) {
    finalMessages.push({
      role: 'system',
      content: summary
    });
  }
  
  for (const chunk of recentChunks) {
    finalMessages.push(...chunk);
  }
  
  let finalTokens = estimateTotalTokens(finalMessages);
  if (finalTokens > maxTokens) {
    const compressed = compressContext(finalMessages, maxTokens * 0.9);
    finalMessages = compressed.messages;
    finalTokens = compressed.compressedTokens;
  }
  
  const tokensSaved = currentTokens - finalTokens;
  const compressionRatio = 1 - (finalTokens / currentTokens);
  
  if (conversationKey && finalMessages.length > 4) {
    const newSummary = createConversationSummary(finalMessages);
    updateConversationMemory(conversationKey, newSummary, finalMessages.slice(-4));
  }
  
  return {
    messages: finalMessages,
    compressed: true,
    compressionRatio,
    tokensSaved,
    originalTokens: currentTokens,
    finalTokens
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
  updateConversationMemory
};
