/**
 * Error Classifier — Classifie les erreurs provider en catégories
 * pour permettre un retry intelligent et un fallback ciblé.
 *
 * Chaque catégorie détermine :
 * - Si l'erreur est retryable
 * - Si la clé doit être blacklistée
 * - Si le provider doit être mis en cooldown
 * - Si le fallback est approprié
 */

const ErrorCategory = {
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  AUTH_ERROR: 'auth_error',
  INVALID_REQUEST: 'invalid_request',
  SERVER_ERROR: 'server_error',
  NETWORK_ERROR: 'network_error',
  QUOTA_EXCEEDED: 'quota_exceeded',
  MODEL_UNAVAILABLE: 'model_unavailable',
  CONTENT_POLICY: 'content_policy',
  STREAM_INTERRUPTED: 'stream_interrupted',
  UNKNOWN: 'unknown',
};

/**
 * Classification rules: for each category we define whether it's retryable,
 * whether to blacklist the key (`blacklistKey`) and whether the failure is
 * imputable au fournisseur (`blacklistProvider`).
 *
 * `blacklistProvider` est la SOURCE UNIQUE DE VÉRITÉ (correction D3) consultée
 * par le proxy pour décider si un échec dégrade la santé du fournisseur :
 * Circuit Breaker (cbV2), health monitor, métriques de performance utilisées par
 * le routeur, et cooldown de la clé. Règle métier : une erreur imputable au
 * client (INVALID_REQUEST, CONTENT_POLICY) doit rester à `false` — sinon
 * quelques requêtes malformées suffisent à ouvrir le circuit d'un fournisseur
 * parfaitement sain ; à l'inverse une déconnexion client n'est même pas
 * classifiée (le proxy sort avant).
 *
 * AUTH_ERROR : politique explicite. Un fournisseur qui rejette nos identifiants
 * n'est plus utilisable pour nous, et l'erreur ne provient pas de la requête du
 * client : la clé est blacklistée 24 h (`blacklistKey`) ET le fournisseur est
 * pénalisé (`blacklistProvider`). Traiter l'auth comme une erreur client
 * laisserait un fournisseur inutilisable en tête de chaîne ; les deux Circuit
 * Breakers (cbV2 et celui alimenté par le KeyPool) restent ainsi cohérents.
 *
 * MODEL_UNAVAILABLE : reste à `false`. L'indisponibilité porte sur UN modèle,
 * alors que tous les mécanismes de santé (les deux Circuit Breakers,
 * `healthMonitor`, `PROVIDER_METRICS`) sont scopés plateforme : les pénaliser
 * écarterait les autres modèles du fournisseur pour un modèle mort. Le
 * fallback est conservé (`retryable` + `skipToNextKey`).
 */
const CLASSIFICATION_RULES = {
  [ErrorCategory.TIMEOUT]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true, // le fournisseur n'a pas répondu dans les délais
    skipToNextKey: true,
    cooldownMs: 10_000,
    description: 'Provider did not respond in time',
  },
  [ErrorCategory.RATE_LIMIT]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true, // politique de santé existante : le fournisseur sature
    skipToNextKey: true,
    cooldownMs: 60_000,
    description: 'Rate limit (429) — try another key or provider',
  },
  [ErrorCategory.AUTH_ERROR]: {
    retryable: false,
    blacklistKey: true,
    blacklistProvider: true, // politique explicite : clé morte → fournisseur inutilisable pour nous
    skipToNextKey: true,
    cooldownMs: 24 * 60 * 60 * 1000, // 24h
    description: 'Invalid API key or unauthorized access',
  },
  [ErrorCategory.INVALID_REQUEST]: {
    retryable: false,
    blacklistKey: false,
    blacklistProvider: false, // erreur du client : aucune pénalité fournisseur (D3)
    skipToNextKey: false,
    cooldownMs: 0,
    description: 'Invalid request payload — will fail with any provider',
  },
  [ErrorCategory.SERVER_ERROR]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true, // panne interne du fournisseur (5xx)
    skipToNextKey: true,
    cooldownMs: 30_000,
    description: 'Provider internal server error (5xx)',
  },
  [ErrorCategory.NETWORK_ERROR]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true, // connectivité du fournisseur en cause
    skipToNextKey: false, // same provider, retry
    cooldownMs: 5_000,
    description: 'Network connectivity issue',
  },
  [ErrorCategory.QUOTA_EXCEEDED]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true,
    skipToNextKey: true,
    cooldownMs: 3600_000, // 1h
    description: 'Token/request quota exhausted for this key',
  },
  [ErrorCategory.MODEL_UNAVAILABLE]: {
    retryable: true,
    blacklistKey: false,
    // Un modèle retiré par un fournisseur ne remet pas en cause ses AUTRES
    // modèles. Pénaliser le fournisseur ici ouvrirait son Circuit Breaker
    // global (les deux CB, plus `PROVIDER_METRICS`/health, tous scopés
    // plateforme) et écarterait des modèles parfaitement sains. Le fallback
    // reste assuré par `skipToNextKey` + `unavailableModelRoutes` (par
    // requête) : on écarte le couple provider/modèle, pas le fournisseur.
    blacklistProvider: false,
    skipToNextKey: true,
    cooldownMs: 300_000, // 5min
    description: 'Requested model is not available on this provider',
  },
  [ErrorCategory.CONTENT_POLICY]: {
    retryable: false,
    blacklistKey: false,
    blacklistProvider: false, // le contenu vient du client : aucune pénalité fournisseur (D3)
    skipToNextKey: false,
    cooldownMs: 0,
    description: 'Content violated provider policy — will fail everywhere',
  },
  [ErrorCategory.STREAM_INTERRUPTED]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true, // flux coupé côté fournisseur
    skipToNextKey: true,
    cooldownMs: 10_000,
    description: 'Stream was interrupted mid-response',
  },
  [ErrorCategory.UNKNOWN]: {
    retryable: true,
    blacklistKey: false,
    blacklistProvider: true,
    skipToNextKey: true,
    cooldownMs: 15_000,
    description: 'Unrecognized error — try another provider',
  },
};

/**
 * Extrait le code HTTP depuis un message d'erreur.
 */
function extractHttpCode(errorMessage) {
  if (!errorMessage) return null;

  // Match patterns like "429", "error 429", "API error 429:", "status 429"
  const match = errorMessage.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extrait le délai de retry depuis le message (Retry-After header etc.)
 */
function extractRetryAfter(errorMessage) {
  if (!errorMessage) return null;

  const patterns = [
    /retry after (\d+(?:\.\d+)?)s?/i,
    /retry in (\d+(?:\.\d+)?)s?/i,
    /try again in (\d+(?:\.\d+)?)s?/i,
    /wait (\d+(?:\.\d+)?)s?/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return Math.ceil(parseFloat(match[1]) * 1000);
    }
  }
  return null;
}

/**
 * Motifs indiquant qu'un fournisseur signale un modèle indisponible/inexistant
 * (et non une requête malformée). Ces motifs sont cherchés dans le message AVANT
 * de conclure qu'un HTTP 400 est une vraie INVALID_REQUEST.
 */
const MODEL_UNAVAILABLE_PATTERNS = [
  /model[^.]{0,60}(unavailable|not available|no longer available|not found|does not exist|doesn't exist|retired|decommissioned|unsupported|not supported)/i,
  /(no such model|unknown model|invalid model|not a valid model|model_not_found|model unavailable|model is unavailable|model currently unavailable)/i,
];

/**
 * Vrai si le message décrit une indisponibilité de modèle (fallback approprié).
 */
function looksLikeModelUnavailable(message) {
  if (!message) return false;
  return MODEL_UNAVAILABLE_PATTERNS.some(re => re.test(message));
}

/**
 * Classe une erreur provider en catégorie structurée.
 *
 * @param {Error|string} error - L'erreur à classifier
 * @param {string} [provider] - Nom du provider (optionnel, pour contexte)
 * @returns {{ category: string, retryable: boolean, blacklistKey: boolean,
 *             blacklistProvider: boolean, skipToNextKey: boolean,
 *             cooldownMs: number, retryAfterMs: number|null,
 *             httpCode: number|null, rawMessage: string }}
 *
 * `blacklistProvider` : vrai si l'échec est imputable au fournisseur. Le proxy
 * s'appuie uniquement sur ce champ pour décider d'appliquer une pénalité
 * (Circuit Breaker, health monitor, métriques, cooldown de clé).
 */
function classifyError(error, provider = null) {
  const rawMessage = typeof error === 'string' ? error : (error?.message || String(error));
  const lowerMsg = rawMessage.toLowerCase();
  const httpCode = extractHttpCode(rawMessage);

  let category;

  // 1. HTTP code-based classification (most reliable)
  if (httpCode) {
    if (httpCode === 429) {
      category = ErrorCategory.RATE_LIMIT;
    } else if (httpCode === 401 || httpCode === 403) {
      category = ErrorCategory.AUTH_ERROR;
    } else if (httpCode === 400 || httpCode === 422) {
      // Un 400 n'est pas toujours une requête invalide : certains fournisseurs
      // renvoient 400 quand LEUR modèle est indisponible. Ce cas doit autoriser
      // le fallback, on inspecte donc le message avant de conclure.
      category = looksLikeModelUnavailable(rawMessage)
        ? ErrorCategory.MODEL_UNAVAILABLE
        : ErrorCategory.INVALID_REQUEST;
    } else if (httpCode === 404) {
      category = ErrorCategory.MODEL_UNAVAILABLE;
    } else if (httpCode >= 500) {
      category = ErrorCategory.SERVER_ERROR;
    }
  }

  // 2. Message-based classification (fallback)
  if (!category) {
    if (lowerMsg.includes('timeout') || lowerMsg.includes('etimedout') || lowerMsg.includes('abort')) {
      category = ErrorCategory.TIMEOUT;
    } else if (lowerMsg.includes('quota exceeded') || lowerMsg.includes('quota_exhausted')) {
      category = ErrorCategory.QUOTA_EXCEEDED;
    } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests')
               || lowerMsg.includes('resource_exhausted')) {
      category = ErrorCategory.RATE_LIMIT;
    } else if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized')
               || lowerMsg.includes('invalid api key') || lowerMsg.includes('authentication')
               || lowerMsg.includes('user not found')) {
      category = ErrorCategory.AUTH_ERROR;
    } else if (lowerMsg.includes('403') || lowerMsg.includes('forbidden')) {
      category = ErrorCategory.AUTH_ERROR;
    } else if (looksLikeModelUnavailable(lowerMsg)) {
      // Modèle indisponible chez le fournisseur : retryable et redirigeable,
      // donc distinct d'une vraie INVALID_REQUEST (à ne pas confondre).
      category = ErrorCategory.MODEL_UNAVAILABLE;
    } else if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument')
               || lowerMsg.includes('bad request')) {
      category = ErrorCategory.INVALID_REQUEST;
    } else if (lowerMsg.includes('econnrefused') || lowerMsg.includes('econnreset')
               || lowerMsg.includes('enotfound') || lowerMsg.includes('network')
               || lowerMsg.includes('fetch failed') || lowerMsg.includes('dns')) {
      category = ErrorCategory.NETWORK_ERROR;
    } else if (lowerMsg.includes('500') || lowerMsg.includes('502') || lowerMsg.includes('503')
               || lowerMsg.includes('internal server') || lowerMsg.includes('unavailable')) {
      category = ErrorCategory.SERVER_ERROR;
    } else if (lowerMsg.includes('content') && lowerMsg.includes('policy')) {
      category = ErrorCategory.CONTENT_POLICY;
    } else if (lowerMsg.includes('model') && (lowerMsg.includes('not found') || lowerMsg.includes('unavailable'))) {
      category = ErrorCategory.MODEL_UNAVAILABLE;
    } else if (lowerMsg.includes('stream') && lowerMsg.includes('interrupt')) {
      category = ErrorCategory.STREAM_INTERRUPTED;
    } else {
      category = ErrorCategory.UNKNOWN;
    }
  }

  const rules = CLASSIFICATION_RULES[category];
  const retryAfterMs = extractRetryAfter(rawMessage);

  return {
    category,
    retryable: rules.retryable,
    blacklistKey: rules.blacklistKey,
    blacklistProvider: rules.blacklistProvider,
    skipToNextKey: rules.skipToNextKey,
    cooldownMs: retryAfterMs || rules.cooldownMs,
    retryAfterMs,
    httpCode,
    rawMessage: rawMessage.slice(0, 500),
    provider,
  };
}

module.exports = {
  ErrorCategory,
  CLASSIFICATION_RULES,
  classifyError,
  looksLikeModelUnavailable,
  extractHttpCode,
  extractRetryAfter,
};
