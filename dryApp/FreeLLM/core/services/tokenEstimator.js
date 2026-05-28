const crypto = require('crypto');

const TOKEN_RATIO = 4; // ~4 chars = 1 token

const TOKEN_BUDGETS = {
  chat: { input: 4000, output: 1000 },
  code: { input: 8000, output: 2000 },
  reasoning: { input: 12000, output: 2000 },
  summary: { input: 16000, output: 1000 },
  translation: { input: 4000, output: 1000 }
};

const PROVIDER_CONTEXT_LIMITS = {
  groq: 32768,
  gemini: 128000,
  openai: 128000,
  mistral: 128000,
  openrouter: 128000,
  cerebras: 256000,
  sambanova: 128000,
  nvidia: 128000,
  github: 128000,
  zhipu: 128000,
  ollama: 128000,
  kilo: 128000,
  pollinations: 128000,
  llm7: 128000,
  cohere: 128000,
  cloudflare: 128000
};

function estimateMessageTokens(message) {
  let content = '';
  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    content = message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ');
  }
  
  // Add role tokens (approx)
  let roleTokens = 0;
  if (message.role === 'system') roleTokens = 5;
  else if (message.role === 'user') roleTokens = 3;
  else if (message.role === 'assistant') roleTokens = 3;
  
  return roleTokens + Math.ceil(content.length / TOKEN_RATIO);
}

function estimateTotalTokens(messages) {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
}

function getTokenBudget(taskType = 'chat') {
  return TOKEN_BUDGETS[taskType] || TOKEN_BUDGETS.chat;
}

function getProviderContextLimit(platform) {
  return PROVIDER_CONTEXT_LIMITS[platform] || 32768;
}

function checkTokenLimits(messages, platform, taskType = 'chat', maxOutputTokens = 1000) {
  const inputTokens = estimateTotalTokens(messages);
  const totalEstimated = inputTokens + maxOutputTokens;
  const providerLimit = getProviderContextLimit(platform);
  const budget = getTokenBudget(taskType);
  
  const issues = [];
  
  if (inputTokens > budget.input) {
    issues.push({
      type: 'budget_exceeded',
      current: inputTokens,
      limit: budget.input,
      message: `Input tokens (${inputTokens}) exceed task budget (${budget.input})`
    });
  }
  
  if (totalEstimated > providerLimit) {
    issues.push({
      type: 'provider_limit_exceeded',
      current: totalEstimated,
      limit: providerLimit,
      message: `Total tokens (${totalEstimated}) exceed provider context limit (${providerLimit})`
    });
  }
  
  return {
    inputTokens,
    totalEstimated,
    budget,
    providerLimit,
    issues,
    needsCompression: issues.some(i => i.type === 'budget_exceeded' || i.type === 'provider_limit_exceeded')
  };
}

function compressContext(messages, targetTokens) {
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  let remainingMessages = systemMessage ? messages.slice(1) : messages;
  
  // Keep the most recent messages
  let compressed = [];
  let currentTokens = systemMessage ? estimateMessageTokens(systemMessage) : 0;
  
  for (let i = remainingMessages.length - 1; i >= 0; i--) {
    const msg = remainingMessages[i];
    const msgTokens = estimateMessageTokens(msg);
    
    if (currentTokens + msgTokens <= targetTokens) {
      compressed.unshift(msg);
      currentTokens += msgTokens;
    } else {
      // Try to truncate the message content if it's too long
      if (typeof msg.content === 'string') {
        const availableChars = (targetTokens - currentTokens) * TOKEN_RATIO;
        if (availableChars > 100) {
          const truncatedContent = msg.content.slice(0, availableChars) + '... [truncated]';
          compressed.unshift({
            ...msg,
            content: truncatedContent
          });
          currentTokens += Math.ceil(truncatedContent.length / TOKEN_RATIO);
        }
      }
      break;
    }
  }
  
  const result = [];
  if (systemMessage) {
    result.push(systemMessage);
  }
  result.push(...compressed);
  
  return {
    messages: result,
    originalTokens: estimateTotalTokens(messages),
    compressedTokens: estimateTotalTokens(result),
    compressionRatio: 1 - (estimateTotalTokens(result) / estimateTotalTokens(messages))
  };
}

module.exports = {
  estimateMessageTokens,
  estimateTotalTokens,
  getTokenBudget,
  getProviderContextLimit,
  checkTokenLimits,
  compressContext
};
