const { decrypt } = require('../lib/crypto.js');
const { canMakeRequest, canUseTokens, isOnCooldown } = require('./ratelimit.js');
const { getProvider } = require('../providers/index.js');
const { circuitBreaker } = require('./inferenceLogger.js');
const { getSuccessRate, getAvgLatency } = require('./performanceMetrics.js');
const { getProviderScore, getKeyStats, IDE_PREFERRED_PROVIDERS } = require('./keyPoolManager.js');

// Index round-robin par plateforme pour distribuer les clés équitablement
const roundRobinIndex = new Map();

// ── Priorité dynamique : on pénalise les modèles qui renvoient des 429 ──
// Clé : modelDbId -> { count, lastHit, penalty }
const rateLimitPenalties = new Map();

// La pénalité décroît avec le temps pour que les modèles se rétablissent
const PENALTY_PER_429 = 3;          // chaque 429 ajoute ce nombre de positions de pénalité
const MAX_PENALTY = 10;              // plafond pour qu'un modèle ne coule pas indéfiniment
const DECAY_INTERVAL_MS = 2 * 60 * 1000; // la pénalité décroît toutes les 2 minutes
const DECAY_AMOUNT = 1;              // quantité retirée par intervalle de décroissance

/**
 * Enregistre un 429 pour un modèle — augmente sa pénalité pour le faire descendre en priorité.
 */
function recordRateLimitHit(modelDbId) {
  const existing = rateLimitPenalties.get(modelDbId);
  const now = Date.now();
  if (existing) {
    existing.count++;
    existing.lastHit = now;
    existing.penalty = Math.min(existing.penalty + PENALTY_PER_429, MAX_PENALTY);
  } else {
    rateLimitPenalties.set(modelDbId, { count: 1, lastHit: now, penalty: PENALTY_PER_429 });
  }
}

/**
 * Enregistre un succès pour un modèle — réduit sa pénalité pour qu'il remonte.
 */
function recordSuccess(modelDbId) {
  const existing = rateLimitPenalties.get(modelDbId);
  if (existing) {
    existing.penalty = Math.max(0, existing.penalty - 1);
    if (existing.penalty === 0) {
      rateLimitPenalties.delete(modelDbId);
    }
  }
}

/**
 * Retourne la pénalité actuelle d'un modèle (avec décroissance temporelle).
 */
function getPenalty(modelDbId) {
  const entry = rateLimitPenalties.get(modelDbId);
  if (!entry) return 0;

  // Appliquer la décroissance basée sur le temps
  const now = Date.now();
  const elapsed = now - entry.lastHit;
  const decaySteps = Math.floor(elapsed / DECAY_INTERVAL_MS);
  if (decaySteps > 0) {
    entry.penalty = Math.max(0, entry.penalty - (decaySteps * DECAY_AMOUNT));
    entry.lastHit = now; // réinitialiser pour éviter une double décroissance
    if (entry.penalty === 0) {
      rateLimitPenalties.delete(modelDbId);
      return 0;
    }
  }

  return entry.penalty;
}

/**
 * Retourne les pénalités de tous les modèles (pour l'API / tableau de bord).
 */
function getAllPenalties() {
  const result = [];
  for (const [modelDbId, entry] of rateLimitPenalties.entries()) {
    const penalty = getPenalty(modelDbId);
    if (penalty > 0) {
      result.push({ modelDbId: String(modelDbId), count: entry.count, penalty });
    }
  }
  return result.sort((a, b) => b.penalty - a.penalty);
}

/**
 * Calcule un score intelligent pour un modèle basé sur :
 * - Priorité de base
 * - Pénalité rate limit
 * - Taux de succès
 * - Latence moyenne
 * - Classement vitesse / intelligence
 */
function calculateModelScore(entry, model, isIdeMode) {
  const basePriority = entry.priority || 0;
  const ratePenalty = getPenalty(entry.modelDbId);

  const successRate = getSuccessRate(model.platform, model.modelId);
  const avgLatency = getAvgLatency(model.platform, model.modelId);

  // Score dynamique du provider depuis keyPoolManager
  const providerScore = getProviderScore(model.platform);

  // Score final (plus haut = mieux)
  let score = providerScore; // base = score dynamique du provider

  // Ajustement selon la priorité de la config de fallback
  score -= basePriority * 5;

  // Pénalité rate limit
  score -= ratePenalty * 20;

  // Bonus taux de succès (0–100 points)
  score += successRate * 100;

  // Bonus latence (0–50 points, plus bas = mieux)
  const latencyScore = Math.min(1, 10000 / (avgLatency || 10000));
  score += latencyScore * 50;

  // Bonus classement vitesse (0–40 points, plus bas = mieux)
  score += (20 - (model.speedRank || 10)) * 2;

  return score;
}

/**
 * Route une requête vers le meilleur modèle disponible.
 * Les modèles sont triés par score intelligent.
 *
 * Si preferredModelDbId est défini, ce modèle est essayé EN PREMIER (sessions sticky).
 * Cela évite les hallucinations dues au changement de modèle en cours de conversation.
 *
 * @param ModelsModel               - Modèle Mongoose pour la collection Models
 * @param ApiKeysModel              - Modèle Mongoose pour la collection ApiKeys
 * @param FallbackConfigModel       - Modèle Mongoose pour la collection FallbackConfig
 * @param estimatedTokens           - Tokens estimés pour la vérification des limites
 * @param skipKeys                  - Set de "platform:modelId:keyId" à ignorer (déjà échoués)
 * @param preferredModelDbId        - Essayer ce modèle en premier (session sticky)
 * @param requestType               - Type de requête (chat, code, reasoning) pour adapter le routing
 * @param isIdeMode                 - Si true, routing optimisé pour l'IDE
 * @param hasTools                  - Si true, router uniquement vers les providers compatibles outils
 * @param userId                    - Si défini, utiliser uniquement les clés appartenant à cet utilisateur
 * @param allowSharedKeysFallback   - Si true (Trivida), utiliser les clés partagées quand l'user n'en a pas
 */
async function routeRequest(ModelsModel, ApiKeysModel, FallbackConfigModel, estimatedTokens = 1000, skipKeys = new Set(), preferredModelDbId, requestType = 'chat', isIdeMode = false, hasTools = false, userId = null, allowSharedKeysFallback = false) {
  // Récupérer la chaîne de fallback triée par priorité
  const fallbackChain = await FallbackConfigModel.find({ deletedAt: null, enabled: true })
    .sort({ priority: 1 })
    .lean();

  // Récupérer tous les modèles en une seule requête DB
  const modelDbIds = fallbackChain.map(entry => entry.modelDbId);
  const allModels = await ModelsModel.find({ _id: { $in: modelDbIds }, enabled: true, deletedAt: null }).lean();
  const modelMap = new Map();
  for (const model of allModels) {
    modelMap.set(String(model._id), model);
  }

  // Providers qui supportent les outils (function calling)
  const TOOLS_SUPPORTED = new Set(['google', 'openrouter']);

  // Calculer les scores et trier du meilleur au moins bon
  const scoredChain = fallbackChain
    .filter(entry => modelMap.has(String(entry.modelDbId)))
    .map(entry => {
      const model = modelMap.get(String(entry.modelDbId));
      return {
        ...entry,
        model,
        score: calculateModelScore(entry, model, isIdeMode)
      };
    })
    .filter(entry => {
      // Si la requête contient des outils, ne garder que les providers compatibles
      if (hasTools) {
        const platformLower = entry.model.platform.toLowerCase();
        for (const goodPlatform of TOOLS_SUPPORTED) {
          if (platformLower.includes(goodPlatform)) {
            return true;
          }
        }
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score); // du plus haut score au plus bas

  // Session sticky : mettre le modèle préféré en tête de liste
  if (preferredModelDbId) {
    const idx = scoredChain.findIndex(e => String(e.modelDbId) === String(preferredModelDbId));
    if (idx > 0) {
      const [preferred] = scoredChain.splice(idx, 1);
      scoredChain.unshift(preferred);
    }
  }

  for (const entry of scoredChain) {
    const model = entry.model;
    if (!model) continue;

    // Vérifier le circuit breaker au niveau du provider
    if (!circuitBreaker.isAvailable(model.platform)) {
      continue;
    }

    // Vérifier qu'on a bien un provider pour cette plateforme
    const provider = getProvider(model.platform);
    if (!provider) continue;

    // Récupérer les clés actives et valides pour cette plateforme.
    // - Si userId fourni → chercher d'abord les clés propres à l'utilisateur
    // - Si aucune clé trouvée ET allowSharedKeysFallback (Trivida) → utiliser les clés partagées
    // - Les utilisateurs du site freellmapi (JWT) doivent avoir leurs propres clés, pas de fallback
    const baseKeyQuery = {
      platform: model.platform,
      enabled: true,
      status: { $ne: 'invalid' },
      deletedAt: null
    };
    let keys = [];
    if (userId) {
      keys = await ApiKeysModel.find({ ...baseKeyQuery, userId }).lean();
    }
    // Fallback sur les clés partagées uniquement pour Trivida
    if (keys.length === 0 && allowSharedKeysFallback) {
      keys = await ApiKeysModel.find(baseKeyQuery).lean();
    }

    if (keys.length === 0) continue;

    // Récupérer les limites du modèle une seule fois
    const limits = {
      rpm: model.rpmLimit,
      rpd: model.rpdLimit,
      tpm: model.tpmLimit,
      tpd: model.tpdLimit,
    };

    // Essayer toutes les clés de ce modèle en round-robin avant d'abandonner
    const rrKey = `${model.platform}:${model.modelId}`;
    let idx = roundRobinIndex.get(rrKey) || 0;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[idx % keys.length];
      idx++;

      const skipId = `${model.platform}:${model.modelId}:${key._id}`;
      if (skipKeys.has(skipId)) continue;

      // Vérifier l'état en mémoire de la clé (keyPoolManager) sans requête DB supplémentaire
      const keyStats = getKeyStats(model.platform, String(key._id));
      if (keyStats) {
        if (keyStats.status === 'invalid') continue;
        if (keyStats.cooldownUntil && Date.now() < keyStats.cooldownUntil) continue;
      }

      // Vérifier le cooldown du rate-limiter
      if (isOnCooldown(model.platform, model.modelId, key._id)) continue;

      if (!canMakeRequest(model.platform, model.modelId, key._id, limits)) continue;
      if (!canUseTokens(model.platform, model.modelId, key._id, estimatedTokens, limits)) continue;

      // Bonne clé trouvée — mettre à jour l'index round-robin
      roundRobinIndex.set(rrKey, idx);

      // Vérifier que les champs de chiffrement sont présents
      if (!key.encryptedKey || !key.iv || !key.authTag) {
        continue;
      }

      // Déchiffrer la clé API
      let decryptedKey;
      try {
        decryptedKey = decrypt(key.encryptedKey, key.iv, key.authTag);
      } catch {
        continue;
      }

      return {
        provider,
        modelId: model.modelId,
        modelDbId: model._id,
        apiKey: decryptedKey,
        keyId: key._id,
        platform: model.platform,
        displayName: model.displayName,
        score: entry.score
      };
    }

    // Aucune clé disponible pour ce modèle.
    // Mettre à jour l'index round-robin quand même pour ne pas bloquer.
    roundRobinIndex.set(rrKey, idx);
  }

  // Aucun modèle/clé disponible — construire un message d'erreur adapté au contexte
  const errMsg = allowSharedKeysFallback
    ? 'Tous les modèles sont épuisés. Ajoutez des clés API ou attendez la réinitialisation des limites.'
    : 'Aucune clé API configurée. Veuillez ajouter vos propres clés API dans les paramètres pour utiliser ce service.';
  const err = new Error(errMsg);
  err.status = allowSharedKeysFallback ? 429 : 402;
  err.code = allowSharedKeysFallback ? 'rate_limit_error' : 'no_api_keys';
  throw err;
}

module.exports = {
  recordRateLimitHit,
  recordSuccess,
  getAllPenalties,
  routeRequest
};
