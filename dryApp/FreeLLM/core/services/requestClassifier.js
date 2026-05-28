const CODE_KEYWORDS = [
  'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
  'import', 'export', 'class', 'interface', 'type', 'async', 'await',
  'react', 'vue', 'angular', 'component', 'hook', 'jsx', 'tsx',
  'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'rust', 'go',
  'code', 'programming', 'algorithm', 'debug', 'error', 'bug', 'fix',
  'function', 'method', 'api', 'endpoint', 'database', 'sql', 'query',
  'git', 'github', 'docker', 'kubernetes', 'terminal', 'command', 'npm'
];

const REASONING_KEYWORDS = [
  'explain', 'why', 'how', 'because', 'therefore', 'thus', 'hence',
  'analyze', 'analyse', 'compare', 'contrast', 'evaluate', 'assess',
  'think', 'reason', 'logic', 'argument', 'proof', 'evidence',
  'hypothesis', 'theory', 'conclusion', 'opinion', 'believe', 'think',
  'what if', 'suppose', 'imagine', 'scenario', 'situation', 'case'
];

const SUMMARY_KEYWORDS = [
  'summarize', 'summary', 'recap', 'tl;dr', 'brief', 'short', 'condense',
  'overview', 'outline', 'key points', 'main ideas', 'abstract',
  'wrap up', 'in short', 'to summarize', 'sum up', 'synthesis'
];

const TRANSLATION_KEYWORDS = [
  'translate', 'translation', 'english', 'french', 'spanish', 'german',
  'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic',
  'in english', 'en français', 'auf deutsch', 'en español', 'em português',
  'language', 'linguistic', 'word', 'phrase', 'sentence'
];

const TASK_PREFERENCES = {
  chat: ['groq', 'cerebras', 'mistral'],
  code: ['mistral', 'openrouter', 'sambanova'],
  reasoning: ['gemini', 'openrouter', 'github'],
  summary: ['gemini', 'groq', 'openrouter'],
  translation: ['groq', 'mistral', 'openrouter']
};

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const msg = messages[i];
      if (typeof msg.content === 'string') return msg.content.toLowerCase();
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join(' ')
          .toLowerCase();
      }
    }
  }
  return '';
}

function countKeywordMatches(text, keywords) {
  let count = 0;
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      count++;
    }
  }
  return count;
}

function classifyRequest(messages) {
  const lastUserText = getLastUserMessage(messages);
  
  if (!lastUserText) {
    return { taskType: 'chat', confidence: 0.7 };
  }
  
  const scores = {
    chat: 3, // Default base score
    code: 0,
    reasoning: 0,
    summary: 0,
    translation: 0
  };
  
  // Calculate scores
  scores.code = countKeywordMatches(lastUserText, CODE_KEYWORDS) * 2;
  scores.reasoning = countKeywordMatches(lastUserText, REASONING_KEYWORDS) * 2;
  scores.summary = countKeywordMatches(lastUserText, SUMMARY_KEYWORDS) * 3;
  scores.translation = countKeywordMatches(lastUserText, TRANSLATION_KEYWORDS) * 3;
  
  // Heuristics
  if (lastUserText.length < 50) scores.chat += 2;
  if (lastUserText.length > 200) scores.summary += 1;
  
  // Find the task with the highest score
  let bestTask = 'chat';
  let bestScore = scores.chat;
  
  for (const [task, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }
  
  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? bestScore / totalScore : 0.7;
  
  return {
    taskType: bestTask,
    confidence: Math.min(1, Math.max(0.5, confidence + 0.2)),
    scores
  };
}

function getPreferredProviders(taskType) {
  return TASK_PREFERENCES[taskType] || TASK_PREFERENCES.chat;
}

function rankModelsForTask(models, taskType, performanceMetrics) {
  const preferredProviders = getPreferredProviders(taskType);
  
  return models.map(model => {
    let score = 0;
    
    // Preference score
    const preferenceIndex = preferredProviders.indexOf(model.platform);
    if (preferenceIndex !== -1) {
      score += (10 - preferenceIndex) * 5;
    }
    
    // Performance metrics
    const metrics = performanceMetrics?.find(m => 
      m.platform === model.platform && m.modelId === model.modelId
    );
    
    if (metrics) {
      score += metrics.successRate * 50;
      score += Math.max(0, 1 - (metrics.avgLatencyMs / 10000)) * 30;
    }
    
    // Speed rank bonus
    score += (20 - (model.speedRank || 10)) * 2;
    
    return { ...model, score };
  }).sort((a, b) => b.score - a.score);
}

module.exports = {
  classifyRequest,
  getPreferredProviders,
  rankModelsForTask
};
