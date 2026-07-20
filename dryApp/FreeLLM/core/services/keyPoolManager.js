const { logger, circuitBreaker } = require('./inferenceLogger');

// Référence au modèle ApiKeysModel pour la mise en liste noire persistante — défini au démarrage
let _ApiKeysModel = null;
function setApiKeysModel(model) { _ApiKeysModel = model; }

/**
 * @typedef {Object} KeyStats
 * @property {number} totalRequests       - Nombre total de requêtes
 * @property {number} successCount        - Nombre de succès
 * @property {number} failureCount        - Nombre d'échecs
 * @property {number} totalLatencyMs      - Latence cumulée en ms
 * @property {number[]} recentLatencies   - Dernières latences enregistrées
 * @property {number} lastUsedAt          - Timestamp de la dernière utilisation
 * @property {number | null} cooldownUntil - Timestamp de fin de cooldown
 * @property {string[]} recentErrors      - Dernières erreurs enregistrées
 * @property {'active' | 'invalid' | 'cooldown'} status - Statut de la clé
 * @property {number | null} disabledAt   - Timestamp de désactivation
 */

/**
 * @typedef {Object} StoredKey
 * @property {string} id
 * @property {string} platform
 * @property {string} encryptedKey
 * @property {string} iv
 * @property {string} authTag
 * @property {KeyStats} stats
 */

/**
 * @typedef {Object} ProviderMetrics
 * @property {number} totalRequests       - Nombre total de requêtes
 * @property {number} successCount        - Nombre de succès
 * @property {number} failureCount        - Nombre d'échecs
 * @property {number} totalLatencyMs      - Latence cumulée en ms
 * @property {number[]} recentLatencies   - Dernières latences
 * @property {number} lastUpdatedAt       - Dernière mise à jour
 * @property {number} priorityBoost       - Bonus de priorité de base
 * @property {boolean} rateLimited        - Provider actuellement rate-limité
 * @property {number | null} retryAfter   - Timestamp à partir duquel réessayer
 */

const KEY_POOL = new Map();        // Map<platform, Map<keyId, StoredKey>>
const PROVIDER_METRICS = new Map(); // Map<platform, ProviderMetrics>
const COOLDOWN_MS = 120000;         // Durée de cooldown par défaut : 2 minutes
const RECENT_LATENCY_COUNT = 10;    // Nombre de latences récentes à conserver

// Décroissance des métriques provider après 1 heure d'inactivité
const PROVIDER_METRICS_DECAY_MS = 3600000;

// Préférences de provider en mode IDE (vitesse privilégiée)
const IDE_PREFERRED_PROVIDERS = {
  'groq': 1000,
  'nvidia': 900,
  'cerebras': 850,
  'sambanova': 700,
  'openrouter': 600,
  'mistral': 500,
  'google': 400,
  'github': 350,
  'cohere': 300,
  'cloudflare': 250,
  'zhipu': 200,
  'ollama': 150,
  'kilo': 100,
  'pollinations': 80,
  'llm7': 50,
  'openai': 0
};

/**
 * Initialise le pool de clés depuis la base de données au démarrage.
 */
async function initializeKeyPool(ApiKeysModel) {
  logger.debug('[KEYPOOL]', {
    event: 'INITIALIZE_START'
  });
  const keys = await ApiKeysModel.find({ deletedAt: null, enabled: true }).lean();

  for (const key of keys) {
    const platform = key.platform;
    if (!KEY_POOL.has(platform)) {
      KEY_POOL.set(platform, new Map());
    }

    if (!PROVIDER_METRICS.has(platform)) {
      PROVIDER_METRICS.set(platform, {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastUpdatedAt: Date.now(),
        priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
        rateLimited: false,
        retryAfter: null
      });
    }

    const keyId = String(key._id);
    KEY_POOL.get(platform).set(keyId, {
      id: keyId,
      platform,
      encryptedKey: key.encryptedKey,
      iv: key.iv,
      authTag: key.authTag,
      stats: {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastUsedAt: 0,
        cooldownUntil: null,
        recentErrors: [],
        status: 'active',
        disabledAt: null
      }
    });
  }

  logger.debug('[KEYPOOL]', {
    event: 'INITIALIZE_COMPLETE',
    keyCount: keys.length,
    platformCount: KEY_POOL.size
  });
}

/**
 * Fait décroître les métriques anciennes pour garder les scores à jour.
 * Appelé avant chaque calcul de score.
 */
function decayProviderMetrics() {
  const now = Date.now();
  for (const [, metrics] of PROVIDER_METRICS) {
    const elapsed = now - metrics.lastUpdatedAt;
    if (elapsed > PROVIDER_METRICS_DECAY_MS) {
      // Diviser par 2 les compteurs pour effacer progressivement l'historique ancien
      metrics.totalRequests = Math.floor(metrics.totalRequests * 0.5);
      metrics.successCount = Math.floor(metrics.successCount * 0.5);
      metrics.failureCount = Math.floor(metrics.failureCount * 0.5);
      metrics.totalLatencyMs = Math.floor(metrics.totalLatencyMs * 0.5);
      metrics.recentLatencies = metrics.recentLatencies.slice(Math.floor(metrics.recentLatencies.length / 2));
      metrics.lastUpdatedAt = now;

      // Réinitialiser le rate limit si le délai est passé
      if (metrics.retryAfter && now > metrics.retryAfter) {
        metrics.rateLimited = false;
        metrics.retryAfter = null;
      }
    }
  }
}

/**
 * Calcule le score dynamique d'un provider basé sur ses métriques temps réel.
 * Un score plus élevé = provider privilégié.
 */
function getProviderScore(platform) {
  decayProviderMetrics();
  const metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) return IDE_PREFERRED_PROVIDERS[platform] || 0;

  let score = metrics.priorityBoost;

  // Forte pénalité si le provider est rate-limité
  if (metrics.rateLimited) {
    score -= 1000;
  }

  // Bonus taux de succès (0–300 points)
  if (metrics.totalRequests > 0) {
    const successRate = metrics.successCount / metrics.totalRequests;
    score += successRate * 300;
  }

  // Bonus latence (0–200 points, latence < 3s = score maximum)
  if (metrics.recentLatencies.length > 0) {
    const avgLatency = metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length;
    const latencyScore = Math.max(0, 200 * (1 - avgLatency / 3000));
    score += latencyScore;
  }

  return score;
}

/**
 * Retourne la liste des plateformes triées par score décroissant.
 */
function getSortedPlatforms() {
  return Array.from(PROVIDER_METRICS.keys())
    .sort((a, b) => getProviderScore(b) - getProviderScore(a));
}

/**
 * Retourne la meilleure clé disponible pour une plateforme donnée.
 * Tient compte du statut, du cooldown et du score individuel de chaque clé.
 */
function getBestKey(platform) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;

  const now = Date.now();
  let bestKey = null;
  let bestScore = -Infinity;

  for (const [, key] of platformKeys) {
    if (key.stats.status !== 'active') continue;
    if (key.stats.cooldownUntil && now < key.stats.cooldownUntil) continue;

    const score = calculateKeyScore(key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

/**
 * Calcule un score dynamique pour une clé individuelle.
 * Basé sur le taux de succès, la latence et la fraîcheur d'utilisation.
 */
function calculateKeyScore(key) {
  const { stats } = key;
  let score = 50; // score de base

  // Bonus taux de succès (0–30 points)
  if (stats.totalRequests > 0) {
    const successRate = stats.successCount / stats.totalRequests;
    score += successRate * 30;
  }

  // Bonus latence (0–20 points)
  if (stats.recentLatencies.length > 0) {
    const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
    const latencyScore = Math.max(0, 20 * (1 - avgLatency / 5000));
    score += latencyScore;
  }

  // Bonus fraîcheur : les clés récemment utilisées avec succès sont légèrement favorisées
  const recencyMs = Date.now() - stats.lastUsedAt;
  const recencyScore = Math.max(0, 10 * (1 - recencyMs / (3600000 * 24)));
  score += recencyScore;

  return score;
}

/**
 * Enregistre une requête réussie pour une clé ET son provider.
 * Met à jour les métriques en mémoire et réinitialise le circuit breaker.
 */
function recordKeySuccess(platform, keyId, latencyMs) {
  const platformKeys = KEY_POOL.get(platform);
  if (platformKeys) {
    const key = platformKeys.get(keyId);
    if (key) {
      const stats = key.stats;
      stats.totalRequests++;
      stats.successCount++;
      stats.totalLatencyMs += latencyMs;
      stats.lastUsedAt = Date.now();

      stats.recentLatencies.push(latencyMs);
      if (stats.recentLatencies.length > RECENT_LATENCY_COUNT) {
        stats.recentLatencies.shift();
      }

      // Réduire légèrement le compteur d'échecs après un succès
      stats.failureCount = Math.max(0, stats.failureCount - 1);
    }
  }

  // Mettre à jour les métriques du provider
  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
      rateLimited: false,
      retryAfter: null
    };
    PROVIDER_METRICS.set(platform, metrics);
  }

  metrics.totalRequests++;
  metrics.successCount++;
  metrics.totalLatencyMs += latencyMs;
  metrics.recentLatencies.push(latencyMs);
  if (metrics.recentLatencies.length > 20) {
    metrics.recentLatencies.shift();
  }
  metrics.lastUpdatedAt = Date.now();

  circuitBreaker.recordSuccess(platform);

  logger.debug('[KEYPOOL]', {
    event: 'KEY_SUCCESS',
    provider: platform,
    keyId,
    latencyMs
  });
}

/**
 * Extrait le délai de retry depuis un message d'erreur (ex: "retry after 30s").
 * Retourne le délai en millisecondes, ou null si introuvable.
 */
function extractRetryDelay(errorMessage) {
  if (!errorMessage) return null;

  const patterns = [
    /retry after (\d+(?:\.\d+)?)/i,
    /retry in (\d+(?:\.\d+)?)/i,
    /try again in (\d+(?:\.\d+)?)/i,
    /wait (\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      const delay = parseFloat(match[1]);
      if (!isNaN(delay)) {
        return Math.ceil(delay * 1000);
      }
    }
  }

  return null;
}

/**
 * Enregistre un échec pour une clé ET son provider.
 * Applique le cooldown approprié selon le type d'erreur :
 * - 401/403 → clé invalide, mise en liste noire 24h et persistée en DB
 * - 429     → rate limit, cooldown selon le délai extrait ou 60s par défaut
 * - autre   → cooldown standard de 2 minutes
 */
function recordKeyFailure(platform, keyId, errorMessage) {
  // Ignorer les erreurs d'abandon réseau (interruption utilisateur, timeout client)
  if (errorMessage && errorMessage.toLowerCase().includes('aborted')) {
    logger.debug('[KEYPOOL]', {
      event: 'IGNORE_ABORTED',
      provider: platform,
      keyId
    });
    return;
  }

  const now = Date.now();
  let cooldownMs = COOLDOWN_MS;
  let keyStatus = 'active';
  let providerRateLimited = false;
  let providerRetryAfter = null;

  if (errorMessage && (errorMessage.toLowerCase().includes('401') || errorMessage.toLowerCase().includes('user not found'))) {
    // Clé invalide / non autorisée → liste noire 24h
    cooldownMs = 24 * 60 * 60 * 1000;
    keyStatus = 'invalid';
    logger.event('KEY_BLACKLISTED', {
      provider: platform,
      keyId,
      reason: '401_UNAUTHORIZED',
      cooldownUntil: now + cooldownMs
    });
  } else if (errorMessage && errorMessage.toLowerCase().includes('403')) {
    // Accès interdit → liste noire 24h
    cooldownMs = 24 * 60 * 60 * 1000;
    keyStatus = 'invalid';
    logger.event('KEY_BLACKLISTED', {
      provider: platform,
      keyId,
      reason: '403_FORBIDDEN',
      cooldownUntil: now + cooldownMs
    });
  } else if (errorMessage && (errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('quota exceeded'))) {
    // Rate limit → cooldown selon le délai du provider ou 60s par défaut
    const extractedDelay = extractRetryDelay(errorMessage);
    if (extractedDelay) {
      cooldownMs = extractedDelay;
      providerRateLimited = true;
      providerRetryAfter = now + extractedDelay;
    } else {
      cooldownMs = 60 * 1000;
      providerRateLimited = true;
      providerRetryAfter = now + cooldownMs;
    }
    logger.event('RATE_LIMITED', {
      provider: platform,
      keyId,
      cooldownMs,
      retryAfter: providerRetryAfter
    });
  }

  // Mettre à jour les stats de la clé en mémoire
  const platformKeys = KEY_POOL.get(platform);
  if (platformKeys) {
    const key = platformKeys.get(keyId);
    if (key) {
      const stats = key.stats;
      stats.totalRequests++;
      stats.failureCount++;
      stats.lastUsedAt = now;

      stats.recentErrors.push(errorMessage);
      if (stats.recentErrors.length > 5) {
        stats.recentErrors.shift();
      }

      stats.cooldownUntil = now + cooldownMs;
      stats.status = keyStatus;
      if (keyStatus === 'invalid') {
        stats.disabledAt = now;
        // Persister en DB de façon asynchrone pour que la clé morte ne soit plus retentée après redémarrage
        if (_ApiKeysModel) {
          _ApiKeysModel.updateOne(
            { _id: keyId },
            { $set: { status: 'invalid', enabled: false } }
          ).catch(dbErr => {
            logger.debug('[KEYPOOL]', { event: 'DB_BLACKLIST_FAILED', keyId, error: dbErr.message });
          });
        }
      }
    }
  }

  // Mettre à jour les métriques du provider
  let metrics = PROVIDER_METRICS.get(platform);
  if (!metrics) {
    metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastUpdatedAt: Date.now(),
      priorityBoost: IDE_PREFERRED_PROVIDERS[platform] || 0,
      rateLimited: false,
      retryAfter: null
    };
    PROVIDER_METRICS.set(platform, metrics);
  }

  metrics.totalRequests++;
  metrics.failureCount++;
  metrics.lastUpdatedAt = Date.now();

  if (providerRateLimited) {
    metrics.rateLimited = true;
    metrics.retryAfter = providerRetryAfter;
  }

  circuitBreaker.recordFailure(platform);

  logger.debug('[KEYPOOL]', {
    event: 'KEY_FAILURE',
    provider: platform,
    keyId,
    errorMessage
  });
}

/**
 * Retourne les statistiques en mémoire d'une clé spécifique.
 */
function getKeyStats(platform, keyId) {
  const platformKeys = KEY_POOL.get(platform);
  if (!platformKeys) return null;

  const key = platformKeys.get(keyId);
  if (!key) return null;

  return key.stats;
}

/**
 * Retourne toutes les statistiques de tous les providers et clés.
 * Utilisé par le tableau de bord d'administration.
 */
function getAllStats() {
  const stats = {
    providers: {},
    keys: {}
  };

  for (const [platform, metrics] of PROVIDER_METRICS) {
    stats.providers[platform] = {
      ...metrics,
      score: getProviderScore(platform),
      circuitBreaker: circuitBreaker.getState(platform)
    };
  }

  for (const [platform, keys] of KEY_POOL) {
    stats.keys[platform] = Array.from(keys.values()).map(key => ({
      keyId: key.id,
      stats: key.stats,
      score: calculateKeyScore(key)
    }));
  }

  return stats;
}

module.exports = {
  initializeKeyPool,
  setApiKeysModel,
  getBestKey,
  recordKeySuccess,
  recordKeyFailure,
  getKeyStats,
  getProviderScore,
  getSortedPlatforms,
  getAllStats,
  IDE_PREFERRED_PROVIDERS
};
