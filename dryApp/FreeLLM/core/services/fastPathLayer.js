const { getCacheKey, get } = require('./responseCache');
const { estimateTotalTokens } = require('./tokenEstimator');

// Greetings and trivial chat patterns (case-insensitive)
const TRIVIAL_PATTERNS = [
  /^(hi|hello|hey|salut|bonjour|coucou|yo)\s*$/i,
  /^(how are you|ça va|comment ça va)\s*$/i,
  /^(thank you|thanks|merci|thx)\s*$/i,
  /^(ok|okay|d'accord|daccord)\s*$/i,
  /^(yes|no|oui|non)\s*$/i,
  /^(good morning|good afternoon|good evening|bonsoir|bonne journée)\s*$/i,
  /^(bye|goodbye|au revoir|à bientôt|a bientot)\s*$/i,
];

// Trivial responses cache (français)
const TRIVIAL_RESPONSES = {
  'hi|hello|hey|salut|bonjour|coucou|yo': 'Bonjour ! Comment puis-je vous aider aujourd\'hui ? 😊',
  'how are you|ça va|comment ça va': 'Je vais très bien, merci ! Et vous ?',
  'thank you|thanks|merci|thx': 'De rien ! Ravis de vous aider ! 😊',
  'ok|okay|d\'accord|daccord': 'Compris ! N\'hésitez pas si vous avez besoin d\'autre chose.',
  'yes|no|oui|non': 'Compris !',
  'good morning|good afternoon|good evening|bonsoir|bonne journée|bonne soirée': 'Bonne journée / soirée à vous aussi ! 🌞',
  'bye|goodbye|au revoir|à bientôt|a bientot|ciao': 'Au revoir ! A la prochaine fois ! 👋'
};

/**
 * Check if a request can bypass full orchestration via Fast Path
 * @param {any[]} messages Chat messages array
 * @param {number} temperature Temperature parameter
 * @param {any} tools Tools parameter
 * @param {any} tool_choice Tool choice parameter
 * @returns {{ fastPath: boolean, cachedResponse?: any, trivialResponse?: string }}
 */
function checkFastPath(messages, temperature, tools, tool_choice) {
  // Fast Path checks in order of speed

  // 1. Cache check - FASTEST
  const cacheable = !tools && !tool_choice && (temperature === 0 || temperature === undefined);
  if (cacheable) {
    const cacheKey = getCacheKey(messages, { temperature });
    const cachedResponse = get(cacheKey);
    if (cachedResponse) {
      console.log('[FastPath] ✅ Cache hit - bypassing full orchestration');
      return { fastPath: true, cachedResponse };
    }
  }

  // 2. Trivial request check - VERY FAST
  const lastUserMsg = getLastUserMessage(messages);
  if (lastUserMsg && lastUserMsg.length < 100) {
    const match = TRIVIAL_PATTERNS.find(pattern => pattern.test(lastUserMsg));
    if (match) {
      let responseText = null;
      for (const [pattern, resp] of Object.entries(TRIVIAL_RESPONSES)) {
        const regex = new RegExp(`^(${pattern})\\s*$`, 'i');
        if (regex.test(lastUserMsg)) {
          responseText = resp;
          break;
        }
      }

      if (responseText) {
        console.log('[FastPath] ✅ Trivial chat - bypassing full orchestration');
        return { fastPath: true, trivialResponse: responseText };
      }
    }
  }

  // 3. Token count check - FAST
  const inputTokens = estimateTotalTokens(messages);
  if (inputTokens < 50) {
    console.log(`[FastPath] 📊 Small request (${inputTokens} tokens) - using optimized path`);
  }

  return { fastPath: false };
}

/**
 * Get the last user message content
 * @param {any[]} messages
 * @returns {string | null}
 */
function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return msg.content;
      } else if (Array.isArray(msg.content)) {
        return msg.content
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join(' ');
      }
    }
  }
  return null;
}

/**
 * Create a trivial response in OpenAI format
 * @param {string} text
 * @returns {any}
 */
function createTrivialResponse(text) {
  return {
    id: 'chatcmpl-trivial-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'trivial-response',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: text
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 5,
      completion_tokens: text.split(' ').length + 5,
      total_tokens: text.split(' ').length + 10
    }
  };
}

module.exports = {
  checkFastPath,
  createTrivialResponse
};