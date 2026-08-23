/**
 * Token Optimization Engine — Moteur intelligent de réduction de tokens.
 *
 * Réduit le nombre de tokens envoyés aux providers LLM en :
 *   - Supprimant les informations redondantes
 *   - Compressant le texte inutile
 *   - Résumant les anciennes conversations
 *   - Protégeant le contenu critique (system prompts, tool schemas, code)
 *
 * S'intègre AU Context Manager existant (pas un système parallèle).
 *
 * Inspiré des concepts RTK/Caveman d'OmniRoute, mais implémentation propre.
 *
 * Règle absolue : exactitude > réduction de tokens.
 */

const { estimateTotalTokens } = require('./tokenEstimator.js');
const { Priority, extractText, isProtected, classifyMessagePriority } = require('./contextManager.js');
const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// 1. TOKEN ANALYZER — Estimation détaillée par catégorie
// ═══════════════════════════════════════════════════════════════

const TOKEN_RATIO = 4; // ~4 chars = 1 token

/**
 * Analyse détaillée des tokens d'une requête.
 */
function analyzeTokens(messages, options = {}) {
  const breakdown = {
    system: 0, tool: 0, user: 0, assistant: 0,
    code: 0, toolCall: 0, total: 0,
  };

  for (const msg of messages) {
    const text = extractText(msg);
    const tokens = Math.ceil(text.length / TOKEN_RATIO);
    const role = msg.role || 'unknown';

    if (role === 'system') breakdown.system += tokens;
    else if (role === 'tool') breakdown.tool += tokens;
    else if (role === 'user') breakdown.user += tokens;
    else if (role === 'assistant') breakdown.assistant += tokens;

    // Detect code blocks
    const codeMatches = text.match(/```[\s\S]*?```/g);
    if (codeMatches) {
      const codeTokens = codeMatches.reduce((sum, m) => sum + Math.ceil(m.length / TOKEN_RATIO), 0);
      breakdown.code += codeTokens;
    }

    // Detect tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const tcTokens = Math.ceil(JSON.stringify(msg.tool_calls).length / TOKEN_RATIO);
      breakdown.toolCall += tcTokens;
    }
  }

  breakdown.total = estimateTotalTokens(messages);

  const maxOutput = options.maxOutputTokens || 1000;
  const estimatedTotal = breakdown.total + maxOutput;

  return {
    ...breakdown,
    maxOutputTokens: maxOutput,
    estimatedTotal,
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. CONTENT CLASSIFIER — 7 niveaux de priorité
// ═══════════════════════════════════════════════════════════════

const ContentPriority = {
  CRITICAL: 0,    // System instructions — JAMAIS touché
  PROTECTED: 1,   // Tool schemas, security, code critique
  HIGH: 2,        // User requirements, décisions importantes, recent
  NORMAL: 3,      // Conversation standard
  LOW: 4,         // Ancienne conversation
  REDUNDANT: 5,   // Informations répétées
  DISCARDABLE: 6, // Politesse, filler
};

/**
 * Patterns pour classifier le contenu.
 */
const CRITICAL_PATTERNS = [
  /^(system|instructions?|rules?|constraints?)/i,
  /security|sécurité|confidential|secret|password|credential/i,
  /must not|must always|do not|never|always|forbidden|interdit/i,
];

const PROTECTED_PATTERNS = [
  /tool|function|schema|definition|interface/i,
  /```[\s\S]*?```/,  // code blocks
  /\{[\s\S]*?"type"[\s\S]*?\}/, // JSON schema
  /https?:\/\/[^\s]+/, // URLs
  /\b[A-Z_]{4,}\b/, // CONSTANTS (4+ uppercase chars)
  /\b\d{4,}\b/, // numbers (IDs, versions)
];

const DISCARDABLE_PATTERNS = [
  /^(hi|hello|hey|salut|bonjour|ok|yes|no|oui|non|merci|thanks|bye)\s*[!.?]*$/i,
  /^(comment ça va|how are you|ça va)\s*[!.?]*$/i,
  /^(d'accord|compris|understood|got it|sure|okay)\s*[!.?]*$/i,
  /^(bonne journée|good morning|good night|au revoir)\s*[!.?]*$/i,
];

const REDUNDANT_PATTERNS = [
  /^(pour rappel|comme mentionné|comme dit|rappelons|note:|reminder)/i,
  /^(comme précédemment|as mentioned|as noted|previously)/i,
];

/**
 * Classifie un message avec un niveau de priorité détaillé.
 */
function classifyContent(message, context = {}) {
  if (!message) return ContentPriority.DISCARDABLE;

  const text = extractText(message);
  const role = message.role;

  // System messages → CRITICAL
  if (role === 'system') {
    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(text)) return ContentPriority.CRITICAL;
    }
    return ContentPriority.CRITICAL;
  }

  // Tool messages → PROTECTED
  if (role === 'tool') return ContentPriority.PROTECTED;

  // Tool calls → PROTECTED
  if (message.tool_calls?.length > 0) return ContentPriority.PROTECTED;

  // Check for protected patterns
  for (const pattern of PROTECTED_PATTERNS) {
    if (pattern.test(text)) return ContentPriority.PROTECTED;
  }

  // Check for discardable
  for (const pattern of DISCARDABLE_PATTERNS) {
    if (pattern.test(text.trim())) return ContentPriority.DISCARDABLE;
  }

  // Check for redundant
  for (const pattern of REDUNDANT_PATTERNS) {
    if (pattern.test(text)) return ContentPriority.REDUNDANT;
  }

  // Very short messages in user role → likely LOW
  if (role === 'user' && text.length < 3) return ContentPriority.LOW;

  // Recent assistant messages with tool calls → HIGH
  if (role === 'assistant' && message.tool_calls?.length > 0) return ContentPriority.HIGH;

  // Long assistant messages → HIGH (contains work)
  if (role === 'assistant' && text.length > 200) return ContentPriority.HIGH;

  // User messages → NORMAL (contains intent)
  if (role === 'user') return ContentPriority.NORMAL;

  // Recent conversation → NORMAL
  if (context.isRecent) return ContentPriority.NORMAL;

  // Old conversation → LOW
  return ContentPriority.LOW;
}

// ═══════════════════════════════════════════════════════════════
// 3. DEDUPLICATION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Normalise un texte pour comparaison.
 */
function normalizeText(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la similarité entre deux textes (Jaccard simplifié).
 */
function textSimilarity(a, b) {
  const wordsA = new Set(normalizeText(a).split(' '));
  const wordsB = new Set(normalizeText(b).split(' '));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Types de doublons détectés.
 */
const DuplicationType = {
  EXACT: 'exact',         // Texte identique
  NEAR: 'near',           // >80% similaire
  SEMANTIC: 'semantic',   // Même signification, mots différents
  CONFLICTING: 'conflicting', // Informations contradictoires
};

/**
 * Détecte les doublons dans une liste de messages.
 *
 * @param {Array} messages
 * @returns {{ duplicates: Array, keptMessages: Array, stats: object }}
 */
function deduplicateMessages(messages) {
  const seen = [];
  const duplicates = [];
  const keptMessages = [];
  const stats = { exact: 0, near: 0, semantic: 0, conflicting: 0, kept: 0 };

  for (const msg of messages) {
    const text = extractText(msg);
    if (!text || text.length < 10) {
      keptMessages.push(msg);
      stats.kept++;
      continue;
    }

    const normalized = normalizeText(text);
    let isDuplicate = false;
    let dupType = null;

    for (const entry of seen) {
      // Exact duplicate
      if (normalized === entry.normalized) {
        isDuplicate = true;
        dupType = DuplicationType.EXACT;
        stats.exact++;
        break;
      }

      const sim = textSimilarity(text, entry.text);

      // Near duplicate (>80% similar)
      if (sim > 0.8) {
        isDuplicate = true;
        dupType = DuplicationType.NEAR;
        stats.near++;
        break;
      }

      // Semantic duplicate (>60% similar)
      if (sim > 0.6) {
        isDuplicate = true;
        dupType = DuplicationType.SEMANTIC;
        stats.semantic++;
        break;
      }
    }

    if (isDuplicate) {
      duplicates.push({
        message: msg,
        type: dupType,
        originalText: text.slice(0, 100),
      });
    } else {
      seen.push({ text, normalized, message: msg });
      keptMessages.push(msg);
      stats.kept++;
    }
  }

  return { duplicates, keptMessages, stats };
}

// ═══════════════════════════════════════════════════════════════
// 4. SAFE COMPRESSION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Phrases de remplissage à supprimer.
 */
const FILLER_PHRASES = [
  /^(Pour rappel,?\s*)/i,
  /^(Comme nous l'avons déjà indiqué,?\s*)/i,
  /^(Il est important de noter que\s*)/i,
  /^(Il convient de souligner que\s*)/i,
  /^(Comme mentionné précédemment,?\s*)/i,
  /^(En d'autres termes,?\s*)/i,
  /^(Pour faire simple,?\s*)/i,
  /^(En résumé,?\s*)/i,
  /^(Il faut également noter que\s*)/i,
  /^(De plus,?\s*)/i,
  /^(En outre,?\s*)/i,
  /^(Par ailleurs,?\s*)/i,
  /^(Cependant,?\s*)/i,
  /^(Néanmoins,?\s*)/i,
  /^(En revanche,?\s*)/i,
];

/**
 * Détecte si un texte contient du code.
 */
function containsCode(text) {
  if (!text) return false;
  return /```[\s\S]*?```/.test(text) ||
    /`[^`]+`/.test(text) ||
    /(?:function|class|const|let|var|import|export|return|if|for|while)\s/.test(text);
}

/**
 * Compresse un texte de manière sûre (sans détruire le sens).
 */
function safeCompressText(text, aggressiveness = 'safe') {
  if (!text || text.length < 50) return text;
  if (containsCode(text)) return text; // Never compress code

  let compressed = text;

  // 1. Remove filler phrases
  for (const pattern of FILLER_PHRASES) {
    compressed = compressed.replace(pattern, '');
  }

  // 2. Compress multiple spaces
  compressed = compressed.replace(/\s{2,}/g, ' ');

  // 3. Compress repeated sentences
  const sentences = compressed.split(/(?<=[.!?])\s+/);
  const uniqueSentences = [];
  const seenSentences = new Set();
  for (const s of sentences) {
    const normalized = normalizeText(s);
    if (!seenSentences.has(normalized)) {
      seenSentences.add(normalized);
      uniqueSentences.push(s);
    }
  }
  compressed = uniqueSentences.join(' ');

  if (aggressiveness === 'aggressive') {
    // 4. Truncate long sentences
    compressed = compressed.replace(/([^.!?]{200,}?)[.!?]/g, '$1.');
    // 5. Remove parenthetical asides
    compressed = compressed.replace(/\([^)]{30,}\)/g, '');
    // 6. Remove quoted text
    compressed = compressed.replace(/"[^"]{50,}"/g, '"[...]');
  }

  return compressed.trim();
}

// ═══════════════════════════════════════════════════════════════
// 5. SUMMARY ENGINE — Résumé des anciennes conversations
// ═══════════════════════════════════════════════════════════════

/**
 * Résume une liste de messages en un résumé structuré.
 */
function summarizeMessages(messages) {
  if (!messages || messages.length === 0) return null;

  const summaryParts = [];
  const topics = new Set();
  const decisions = [];
  const codeRefs = [];

  for (const msg of messages) {
    const text = extractText(msg);
    if (!text || text.length < 20) continue;

    // Extract key facts
    if (msg.role === 'user') {
      summaryParts.push(`USER: ${text.slice(0, 150)}`);
    } else if (msg.role === 'assistant' && text.length > 50) {
      summaryParts.push(`ASST: ${text.slice(0, 150)}`);
    }

    // Extract decisions (sentences with "decided", "chosen", "selected", etc.)
    const decisionMatch = text.match(/(?:décid|choisi|sélectionn|决定|selected|decided|chosen)[^.!?]*[.!?]/gi);
    if (decisionMatch) decisions.push(...decisionMatch.map(d => d.slice(0, 100)));

    // Extract code references
    const codeMatch = text.match(/```[\s\S]{0,200}?```/g);
    if (codeMatch) codeRefs.push(`[code: ${codeMatch[0].slice(0, 80)}...]`);
  }

  // Build structured summary
  let summary = `[CONVERSATION SUMMARY]\n`;
  summary += `Messages: ${messages.length}\n`;

  if (summaryParts.length > 0) {
    summary += `Key exchanges:\n`;
    // Keep only the first and last few exchanges
    const keep = Math.min(summaryParts.length, 6);
    const selected = [...summaryParts.slice(0, 2), ...summaryParts.slice(-keep + 2)];
    summary += selected.map(s => `  - ${s}`).join('\n') + '\n';
  }

  if (decisions.length > 0) {
    summary += `Decisions: ${decisions.slice(0, 3).join('; ')}\n`;
  }

  if (codeRefs.length > 0) {
    summary += `Code involved: ${codeRefs.length} code blocks\n`;
  }

  summary += `[END SUMMARY]`;

  return summary;
}

// ═══════════════════════════════════════════════════════════════
// 6. TOKEN BUDGET MANAGER
// ═══════════════════════════════════════════════════════════════

/**
 * Réservations de tokens par type.
 */
const DEFAULT_BUDGET = {
  reservedOutput: 2000,     // Espace pour la réponse
  reservedSystem: 500,      // Marge pour le system prompt
  reservedToolCalls: 1000,  // Marge pour les tool calls
  reservedOverhead: 200,    // Marge de sécurité
};

/**
 * Calcule le budget disponible pour le contexte.
 */
function calculateBudget(contextWindow, options = {}) {
  const budget = { ...DEFAULT_BUDGET, ...options };
  const reserved = budget.reservedOutput + budget.reservedSystem +
    budget.reservedToolCalls + budget.reservedOverhead;

  return {
    contextWindow,
    reserved,
    availableForContext: Math.max(0, contextWindow - reserved),
    breakdown: budget,
  };
}

/**
 * Détermine quel niveau d'optimisation appliquer selon la taille.
 */
function selectOptimizationMode(tokenCount, budget) {
  const ratio = tokenCount / budget.availableForContext;

  if (ratio <= 0.3) return 'off';
  if (ratio <= 0.5) return 'safe';
  if (ratio <= 0.75) return 'balanced';
  return 'aggressive';
}

// ═══════════════════════════════════════════════════════════════
// 7. OPTIMIZATION VALIDATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie que les informations critiques sont toujours présentes.
 */
function validateOptimization(originalMessages, optimizedMessages) {
  const issues = [];

  // 1. Check system messages preserved
  const origSystem = originalMessages.filter(m => m.role === 'system');
  const optSystem = optimizedMessages.filter(m => m.role === 'system');
  if (optSystem.length < origSystem.length) {
    issues.push({
      type: 'system_lost',
      severity: 'critical',
      detail: `${origSystem.length - optSystem.length} system messages removed`,
    });
  }

  // 2. Check tool schemas preserved
  const origToolSchemas = originalMessages.filter(m =>
    extractText(m).match(/\{[\s\S]*?"type"[\s\S]*?\}/)
  );
  const optToolSchemas = optimizedMessages.filter(m =>
    extractText(m).match(/\{[\s\S]*?"type"[\s\S]*?\}/)
  );
  if (optToolSchemas.length < origToolSchemas.length) {
    issues.push({
      type: 'tool_schema_lost',
      severity: 'critical',
      detail: `${origToolSchemas.length - optToolSchemas.length} tool schemas removed`,
    });
  }

  // 3. Check code blocks preserved
  const origCode = originalMessages.filter(m => containsCode(extractText(m)));
  const optCode = optimizedMessages.filter(m => containsCode(extractText(m)));
  if (optCode.length < origCode.length) {
    issues.push({
      type: 'code_lost',
      severity: 'critical',
      detail: `${origCode.length - optCode.length} code blocks removed`,
    });
  }

  // 4. Check user messages preserved
  const origUser = originalMessages.filter(m => m.role === 'user');
  const optUser = optimizedMessages.filter(m => m.role === 'user');
  if (optUser.length < Math.ceil(origUser.length * 0.5)) {
    issues.push({
      type: 'too_many_user_messages_lost',
      severity: 'high',
      detail: `${origUser.length - optUser.length} user messages removed`,
    });
  }

  // 5. Check critical content patterns preserved
  const origText = originalMessages.map(extractText).join(' ');
  const optText = optimizedMessages.map(extractText).join(' ');

  const criticalPatterns = [
    /\b\d{4,}\b/, // Long numbers (IDs, versions)
    /https?:\/\/[^\s]+/, // URLs
    /\b[A-Z_]{3,}\b/, // CONSTANTS
  ];

  for (const pattern of criticalPatterns) {
    const origMatches = origText.match(pattern);
    const optMatches = optText.match(pattern);
    if (origMatches && !optMatches) {
      issues.push({
        type: 'critical_content_lost',
        severity: 'high',
        detail: `Pattern ${pattern.source} found in original but not in optimized`,
      });
    }
  }

  const isValid = !issues.some(i => i.severity === 'critical');
  return { isValid, issues, optimizedMessageCount: optimizedMessages.length };
}

// ═══════════════════════════════════════════════════════════════
// 8. TOKEN OPTIMIZATION ENGINE — Orchestrateur central
// ═══════════════════════════════════════════════════════════════

const OPTIMIZATION_MODES = { OFF: 'off', SAFE: 'safe', BALANCED: 'balanced', AGGRESSIVE: 'aggressive' };

class TokenOptimizationEngine {
  constructor(options = {}) {
    this.defaultMode = options.mode || OPTIMIZATION_MODES.BALANCED;
    this.contextWindow = options.contextWindow || 128000;
    this.stats = {
      totalRequests: 0,
      optimizedRequests: 0,
      tokensBefore: 0,
      tokensAfter: 0,
      totalSaved: 0,
      deduplicationCount: 0,
      compressionCount: 0,
      summaryCount: 0,
      errors: 0,
    };
    this.metrics = []; // per-request metrics
  }

  /**
   * Optimise le contexte d'une requête.
   *
   * @param {Array} messages - Messages originaux
   * @param {object} options - Options d'optimisation
   * @param {string} [options.mode] - Mode d'optimisation
   * @param {string} [options.provider] - Provider cible
   * @param {string} [options.model] - Modèle cible
   * @param {string} [options.taskType] - Type de tâche
   * @param {number} [options.maxOutputTokens] - Tokens de sortie max
   * @returns {{ messages: Array, metrics: object }}
   */
  optimize(messages, options = {}) {
    const startTime = Date.now();
    const requestId = options.requestId || 'unknown';

    this.stats.totalRequests++;

    // Safety: never optimize empty messages
    if (!messages || messages.length === 0) {
      return { messages, metrics: this._noOptMetrics(startTime) };
    }

    // Filter out null/undefined messages for safety
    const safeMessages = messages.filter(m => m != null);
    if (safeMessages.length === 0) {
      return { messages, metrics: this._noOptMetrics(startTime) };
    }

    // Determine mode
    const budget = calculateBudget(this.contextWindow, {
      reservedOutput: options.maxOutputTokens || 2000,
    });
    const originalTokens = estimateTotalTokens(safeMessages);

    let mode = options.mode || this.defaultMode;
    if (mode === OPTIMIZATION_MODES.OFF) {
      return { messages, metrics: this._noOptMetrics(startTime) };
    }

    // Auto-select mode based on token count
    if (!options.mode) {
      mode = selectOptimizationMode(originalTokens, budget);
    }

    // Skip optimization for small contexts
    if (originalTokens < 2000 && mode !== OPTIMIZATION_MODES.AGGRESSIVE) {
      return { messages, metrics: this._noOptMetrics(startTime) };
    }

    try {
      let optimized = [...safeMessages];
      const stepMetrics = { dedupRemoved: 0, compressed: 0, summarized: 0, discarded: 0 };

      // Step 1: Classify all messages
      const classified = optimized.map((msg, idx) => ({
        message: msg,
        priority: classifyContent(msg, { isRecent: idx >= optimized.length - 10 }),
        tokens: estimateTotalTokens([msg]),
      }));

      // Step 2: Deduplication (SAFE+)
      if (mode !== OPTIMIZATION_MODES.OFF) {
        const { keptMessages, stats } = deduplicateMessages(optimized);
        stepMetrics.dedupRemoved = stats.exact + stats.near;
        this.stats.deduplicationCount += stepMetrics.dedupRemoved;
        optimized = keptMessages;
      }

      // Step 3: Remove DISCARDABLE content (SAFE+)
      if (mode !== OPTIMIZATION_MODES.OFF) {
        const before = optimized.length;
        optimized = optimized.filter((msg, idx) => {
          const priority = classifyContent(msg, { isRecent: idx >= optimized.length - 10 });
          return priority < ContentPriority.DISCARDABLE;
        });
        stepMetrics.discarded = before - optimized.length;
      }

      // Step 4: Safe compression (BALANCED+)
      if (mode === OPTIMIZATION_MODES.BALANCED || mode === OPTIMIZATION_MODES.AGGRESSIVE) {
        optimized = optimized.map(msg => {
          if (msg.role === 'system') return msg; // Never compress system
          if (containsCode(extractText(msg))) return msg; // Never compress code
          if (msg.tool_calls?.length > 0) return msg; // Never compress tool calls

          const text = extractText(msg);
          const compressed = safeCompressText(text, mode === OPTIMIZATION_MODES.AGGRESSIVE ? 'aggressive' : 'safe');
          if (compressed !== text) {
            stepMetrics.compressed++;
            return { ...msg, content: compressed };
          }
          return msg;
        });
      }

      // Step 5: Summarize old messages if still over budget (BALANCED+)
      const currentTokens = estimateTotalTokens(optimized);
      if (currentTokens > budget.availableForContext &&
          (mode === OPTIMIZATION_MODES.BALANCED || mode === OPTIMIZATION_MODES.AGGRESSIVE)) {
        // Keep first 2 messages (system) + last N messages
        const systemMsgs = optimized.filter(m => m.role === 'system');
        const nonSystem = optimized.filter(m => m.role !== 'system');

        if (nonSystem.length > 10) {
          const oldMessages = nonSystem.slice(0, nonSystem.length - 10);
          const recentMessages = nonSystem.slice(-10);

          const summary = summarizeMessages(oldMessages);
          if (summary) {
            optimized = [...systemMsgs, { role: 'system', content: summary }, ...recentMessages];
            stepMetrics.summarized = oldMessages.length;
            this.stats.summaryCount++;
          }
        }
      }

      // Step 6: Validate
      const validation = validateOptimization(messages, optimized);
      if (!validation.isValid) {
        // Rollback on critical issues
        logger.event('OPTIMIZATION_ROLLBACK', {
          requestId, issues: validation.issues,
        });
        this.stats.errors++;
        return { messages, metrics: this._errorMetrics(startTime, 'validation_failed') };
      }

      // Calculate metrics
      const finalTokens = estimateTotalTokens(optimized);
      const tokensSaved = originalTokens - finalTokens;
      const compressionRatio = originalTokens > 0 ? tokensSaved / originalTokens : 0;

      this.stats.optimizedRequests++;
      this.stats.tokensBefore += originalTokens;
      this.stats.tokensAfter += finalTokens;
      this.stats.totalSaved += tokensSaved;
      this.stats.compressionCount += stepMetrics.compressed;

      const metrics = {
        requestId,
        tokensBefore: originalTokens,
        tokensAfter: finalTokens,
        tokensSaved,
        compressionRatio: (compressionRatio * 100).toFixed(1) + '%',
        compressionRatioRaw: compressionRatio,
        mode,
        optimizationDurationMs: Date.now() - startTime,
        ...stepMetrics,
        provider: options.provider || null,
        model: options.model || null,
        taskType: options.taskType || null,
        messageCountBefore: messages.length,
        messageCountAfter: optimized.length,
        validation: { isValid: true, issues: validation.issues },
      };

      this.metrics.push(metrics);
      if (this.metrics.length > 500) this.metrics.shift();

      return { messages: optimized, metrics };
    } catch (err) {
      // Safety: optimization failure ≠ request failure
      logger.error('[TokenOptimization]', {
        event: 'OPTIMIZATION_ERROR', requestId, error: err.message,
      });
      this.stats.errors++;
      return { messages, metrics: this._errorMetrics(startTime, err.message) };
    }
  }

  _noOptMetrics(startTime) {
    return {
      tokensBefore: 0, tokensAfter: 0, tokensSaved: 0,
      compressionRatio: '0%', mode: 'off',
      optimizationDurationMs: Date.now() - startTime,
    };
  }

  _errorMetrics(startTime, reason) {
    return {
      tokensBefore: 0, tokensAfter: 0, tokensSaved: 0,
      compressionRatio: '0%', mode: 'error',
      optimizationDurationMs: Date.now() - startTime,
      error: reason,
    };
  }

  /**
   * Get aggregate stats (for dashboard).
   */
  getStats() {
    const avgReduction = this.stats.optimizedRequests > 0
      ? ((this.stats.totalSaved / this.stats.tokensBefore) * 100).toFixed(1) + '%'
      : '0%';

    return {
      ...this.stats,
      avgReduction,
      avgOptimizationTime: this.metrics.length > 0
        ? Math.round(this.metrics.reduce((s, m) => s + m.optimizationDurationMs, 0) / this.metrics.length)
        : 0,
    };
  }

  /**
   * Get recent optimization metrics.
   */
  getRecentMetrics(limit = 50) {
    return this.metrics.slice(-limit);
  }

  /**
   * Get current config.
   */
  getConfig() {
    return {
      mode: this.defaultMode,
      contextWindow: this.contextWindow,
      thresholds: { small: 2000, medium: 10000, large: 50000 },
      protectedPriorityLevels: [ContentPriority.CRITICAL, ContentPriority.PROTECTED],
      deduplication: { enabled: true, nearDuplicateThreshold: 0.85 },
      compressionEnabled: true,
      summaryEnabled: true,
      minMessagesForSummary: 10,
    };
  }

  /**
   * Update config.
   */
  setConfig(updates = {}) {
    if (updates.mode !== undefined) this.defaultMode = updates.mode;
    if (updates.contextWindow !== undefined) this.contextWindow = updates.contextWindow;
    // Store extra config on instance for future use
    this._config = { ...this.getConfig(), ...updates };
  }
}

// ═══ Singleton ════════════════════════════════════════════════
const tokenOptimization = new TokenOptimizationEngine();

module.exports = {
  // Enums
  ContentPriority,
  DuplicationType,
  OPTIMIZATION_MODES,
  // Sub-modules
  analyzeTokens,
  classifyContent,
  deduplicateMessages,
  safeCompressText,
  containsCode,
  summarizeMessages,
  calculateBudget,
  selectOptimizationMode,
  validateOptimization,
  textSimilarity,
  normalizeText,
  // Engine
  TokenOptimizationEngine,
  tokenOptimization,
  // Convenience
  getConfig: () => tokenOptimization.getConfig(),
  setConfig: (updates) => tokenOptimization.setConfig(updates),
};
