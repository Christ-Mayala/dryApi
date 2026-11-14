/**
 * Response Validator — Valide systématiquement les réponses des providers
 * avant de les transmettre au client.
 *
 * HTTP 200 ne signifie pas toujours "réponse valide". Un provider peut renvoyer :
 * - un body vide
 * - du HTML au lieu de JSON
 * - un JSON malformé
 * - un choix sans contenu
 * - des tool calls invalides
 * - un finish_reason inattendu
 */

const { logger } = require('./inferenceLogger');

/**
 * Types d'erreurs de validation
 */
const ValidationIssue = {
  EMPTY_RESPONSE: 'empty_response',
  MALFORMED_JSON: 'malformed_json',
  MISSING_CHOICES: 'missing_choices',
  EMPTY_CONTENT: 'empty_content',
  INVALID_TOOL_CALLS: 'invalid_tool_calls',
  TRUNCATED: 'truncated',
  WRONG_FORMAT: 'wrong_format',
  UNEXPECTED_FINISH: 'unexpected_finish',
};

/**
 * Valide une réponse non-streaming d'un provider.
 *
 * @param {object} response - La réponse brute du provider
 * @param {object} options - Options de validation
 * @param {boolean} [options.expectToolCalls=false] - Si true, des tool_calls sont attendus
 * @param {boolean} [options.allowEmptyContent=false] - Si true, un content vide est accepté (ex: tool_calls only)
 * @param {string} [options.provider] - Nom du provider pour les logs
 * @returns {{ valid: boolean, issues: string[], sanitizedResponse: object|null }}
 */
function validateResponse(response, options = {}) {
  const { expectToolCalls = false, allowEmptyContent = false, provider = 'unknown' } = options;
  const issues = [];

  // 1. Response exists and is an object
  if (!response || typeof response !== 'object') {
    issues.push(ValidationIssue.EMPTY_RESPONSE);
    logger.debug('[ResponseValidator]', { event: 'INVALID_RESPONSE', provider, issues });
    return { valid: false, issues, sanitizedResponse: null };
  }

  // 2. Has id field
  if (!response.id && response.id !== 0) {
    // Some providers omit id — not critical
  }

  // 3. Has choices array
  if (!Array.isArray(response.choices) || response.choices.length === 0) {
    issues.push(ValidationIssue.MISSING_CHOICES);
    logger.debug('[ResponseValidator]', { event: 'NO_CHOICES', provider, issues });
    return { valid: false, issues, sanitizedResponse: null };
  }

  // 4. Validate first choice
  const choice = response.choices[0];
  if (!choice) {
    issues.push(ValidationIssue.MISSING_CHOICES);
    return { valid: false, issues, sanitizedResponse: null };
  }

  const message = choice.message;
  if (!message || typeof message !== 'object') {
    issues.push(ValidationIssue.WRONG_FORMAT);
    logger.debug('[ResponseValidator]', { event: 'NO_MESSAGE', provider, issues });
    return { valid: false, issues, sanitizedResponse: null };
  }

  // 5. Check content
  const hasTextContent = typeof message.content === 'string' && message.content.length > 0;
  const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

  if (!hasTextContent && !hasToolCalls && !allowEmptyContent) {
    issues.push(ValidationIssue.EMPTY_CONTENT);
    logger.debug('[ResponseValidator]', { event: 'EMPTY_CONTENT', provider, issues });
    return { valid: false, issues, sanitizedResponse: null };
  }

  // 6. Validate tool calls if present
  if (hasToolCalls) {
    for (const tc of message.tool_calls) {
      if (!tc.id || !tc.function || !tc.function.name) {
        issues.push(ValidationIssue.INVALID_TOOL_CALLS);
        logger.debug('[ResponseValidator]', { event: 'INVALID_TOOL_CALL', provider, tc });
        // Don't fail — some providers have slightly different formats
        // Just log the issue
        break;
      }
    }
  }

  // 7. Validate tool_calls consistency
  if (expectToolCalls && !hasToolCalls && !hasTextContent) {
    issues.push(ValidationIssue.UNEXPECTED_FINISH);
  }

  // 8. Check finish_reason
  const validFinishReasons = ['stop', 'length', 'tool_calls', 'content_filter', 'null'];
  if (choice.finish_reason && !validFinishReasons.includes(choice.finish_reason)) {
    // Log but don't fail — some providers use non-standard reasons
    logger.debug('[ResponseValidator]', {
      event: 'UNUSUAL_FINISH_REASON',
      provider,
      finish_reason: choice.finish_reason,
    });
  }

  // 9. Validate usage (optional but useful)
  if (response.usage) {
    if (typeof response.usage.prompt_tokens !== 'number' ||
        typeof response.usage.completion_tokens !== 'number') {
      // Some providers don't provide accurate usage — don't fail
      logger.debug('[ResponseValidator]', {
        event: 'INCOMPLETE_USAGE',
        provider,
      });
    }
  }

  // 10. Check for truncated content (suspicious if finish_reason is 'length')
  if (choice.finish_reason === 'length' && hasTextContent) {
    // Content was truncated — still valid but flagged
    issues.push(ValidationIssue.TRUNCATED);
  }

  const sanitizedResponse = sanitizeResponse(response);

  if (issues.length > 0) {
    logger.debug('[ResponseValidator]', {
      event: 'RESPONSE_VALIDATED_WITH_ISSUES',
      provider,
      issues,
      hasTextContent,
      hasToolCalls,
    });
  }

  return {
    valid: true, // Response is usable even with minor issues
    issues,
    sanitizedResponse,
  };
}

/**
 * Détecte si un chunk de streaming porte un contenu exploitable.
 *
 * Tous les fournisseurs n'émettent pas le texte dans `delta.content` : certains
 * utilisent `delta.reasoning_content` (modèles de raisonnement), d'autres
 * renvoient un `message.content` non standard, d'autres encore n'émettent que
 * des `tool_calls`. Un chunk qui n'apporte ni texte, ni raisonnement, ni
 * tool_call (ex. delta vide, chunk de `usage` seul, chunk `finish_reason` seul)
 * n'est pas un contenu et ne doit pas suffire à qualifier la génération.
 *
 * @param {object} chunk - Chunk SSE au format OpenAI
 * @returns {boolean} true si le chunk contient un contenu exploitable
 */
function chunkHasMeaningfulContent(chunk) {
  if (!chunk || typeof chunk !== 'object') return false;
  const choices = Array.isArray(chunk.choices) ? chunk.choices : [];

  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue;

    const delta = choice.delta;
    if (delta && typeof delta === 'object') {
      if (typeof delta.content === 'string' && delta.content.length > 0) return true;
      // Certains fournisseurs émettent `delta.content` sous forme de tableau de
      // blocs (ex. [{ type: 'text', text: '…' }]) au lieu d'une chaîne : c'est un
      // contenu valide, il ne doit pas être pris pour un flux vide.
      if (Array.isArray(delta.content) && delta.content.length > 0) return true;
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) return true;
      if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) return true;
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) return true;
    }

    const message = choice.message;
    if (message && typeof message === 'object') {
      if (typeof message.content === 'string' && message.content.length > 0) return true;
      if (Array.isArray(message.content) && message.content.length > 0) return true;
      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) return true;
    }

    // Un provider peut signaler explicitement un blocage / appel d'outil dans
    // le chunk final, sans texte : ce n'est pas un flux vide.
    if (choice.finish_reason === 'content_filter' || choice.finish_reason === 'tool_calls') return true;
  }

  return false;
}

/**
 * Sanitize a response to ensure it has the expected OpenAI-compatible format.
 */
function sanitizeResponse(response) {
  const sanitized = { ...response };

  // Ensure choices is an array
  if (!Array.isArray(sanitized.choices)) {
    sanitized.choices = [];
  }

  // Ensure each choice has the expected structure
  sanitized.choices = sanitized.choices.map(choice => {
    if (!choice || typeof choice !== 'object') return { index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' };

    const c = { ...choice };
    if (!c.message) c.message = { role: 'assistant', content: '' };
    if (typeof c.message.content !== 'string') {
      // Handle array content (some providers return content as array of segments)
      if (Array.isArray(c.message.content)) {
        c.message.content = c.message.content
          .map(seg => (typeof seg === 'string' ? seg : (seg.text ?? '')))
          .join('');
      } else if (c.message.content === null || c.message.content === undefined) {
        c.message.content = '';
      }
    }
    if (typeof c.index !== 'number') c.index = 0;
    if (!c.finish_reason) c.finish_reason = 'stop';

    return c;
  });

  // Ensure usage object exists
  if (!sanitized.usage) {
    sanitized.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }

  return sanitized;
}

module.exports = {
  ValidationIssue,
  validateResponse,
  sanitizeResponse,
  chunkHasMeaningfulContent,
};
