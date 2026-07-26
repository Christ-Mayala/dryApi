/**
 * Data Retention Service
 * Nettoie automatiquement les logs et données temporaires
 * qui s'accumulent dans toutes les applications (FreeLLM, SCIM, Pelerin, etc.)
 *
 * Configuration via variables d'environnement :
 *   RETENTION_ENABLED       = true/false (défaut: true)
 *   RETENTION_DAYS_LOG      = jours de rétention pour logs système (défaut: 7)
 *   RETENTION_DAYS_AUDIT    = jours de rétention pour audit logs (défaut: 7)
 *   RETENTION_DAYS_REQUESTS = jours de rétention pour requêtes IA (défaut: 7)
 *   RETENTION_DAYS_CONVERSATIONS = jours pour conversations inactives (défaut: 30)
 *   RETENTION_DAYS_MESSAGES = jours pour messages (défaut: 30)
 *   RETENTION_DAYS_LOGS_APP = jours pour logs spécifiques (défaut: 30)
 */

const { getTenantDB } = require('../../config/connection/dbConnection');
const { getAppNames } = require('../../core/application/appScanner');

// ─── Règles de rétention par collection ─────────────────────────────────────
// Chaque règle définit :
//   collection : nom de la collection MongoDB
//   days       : nombre de jours de rétention (configurable via env)
//   envVar     : nom de la variable d'environnement pour surcharger
//   dateField  : champ date à utiliser pour le filtre (défaut: createdAt)
//   extraFilter: filtre supplémentaire optionnel

const buildRetentionDate = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);



/**
 * Nettoie les logs système (Log + AuditLog) dans la base d'une application
 * @param {Object} db - Connexion mongoose à la base du tenant
 * @param {string} appName - Nom de l'application
 * @param {Object} rules - Règles de rétention
 * @returns {Promise<{app: string, collections: number, deleted: number, details: Array}>}
 */
const cleanAppLogs = async (db, appName, rules) => {
  if (!db?.db) {
    return { app: appName, collections: 0, deleted: 0, details: [] };
  }

  let totalDeleted = 0;
  const details = [];

  for (const rule of rules) {
    try {
      const cutoff = buildRetentionDate(rule.days);
      const dateField = rule.dateField || 'createdAt';
      const filter = { [dateField]: { $lt: cutoff } };

      // Appliquer le filtre supplémentaire si présent (ex: status particulier)
      if (rule.extraFilter) {
        Object.assign(filter, rule.extraFilter);
      }

      // Vérifier si la collection existe avant d'essayer de supprimer
      const collections = await db.db.listCollections({ name: rule.collection }).toArray();
      if (collections.length === 0) {
        details.push({ collection: rule.collection, deleted: 0, status: 'absent' });
        continue;
      }

      const result = await db.db.collection(rule.collection).deleteMany(filter);
      const deleted = result?.deletedCount || 0;
      totalDeleted += deleted;
      details.push({ collection: rule.collection, deleted, status: 'ok' });
    } catch (err) {
      details.push({ collection: rule.collection, deleted: 0, status: `erreur: ${err.message}` });
    }
  }

  return { app: appName, deleted: totalDeleted, details };
};

/**
 * Nettoie les données temporaires dans TOUTES les applications
 * @param {Object} [options]
 * @param {number} [options.daysLog] - Jours pour logs système
 * @param {number} [options.daysRequests] - Jours pour requêtes IA
 * @param {number} [options.daysConversations] - Jours pour conversations inactives
 * @param {number} [options.daysMessages] - Jours pour messages
 * @returns {Promise<{startedAt: Date, cutoff: Object, results: Array}>}
 */
const runDataRetention = async (options = {}) => {
  const startedAt = new Date();

  // Règles communes à TOUTES les applications (logs système)
  // Les durées sont passées depuis le scheduler (lui-même configuré via config/database.js)
  const COMMON_RULES = [
    { collection: 'logs',          days: options.daysLog ?? 7 },
    { collection: 'auditlogs',     days: options.daysAudit ?? 7 },
  ];

  // Règles spécifiques par application
  const APP_RULES = {
    FreeLLM: [
      { collection: 'requests',            days: options.daysRequests ?? 7 },
      { collection: 'conversations',       days: options.daysConversations ?? 30, dateField: 'updatedAt' },
      { collection: 'conversationmessages',days: options.daysConversations ?? 30 },
    ],
    SCIM: [
      { collection: 'messages',            days: options.daysMessages ?? 30 },
      { collection: 'propertyviews',       days: options.daysViews ?? 7 },
    ],
    Pelerin: [
      { collection: 'habitlogs',           days: options.daysLogsApp ?? 30 },
      { collection: 'meditationlogs',      days: options.daysLogsApp ?? 30 },
    ],
    Trivida: [
      { collection: 'activities',          days: options.daysLogsApp ?? 7 },
      { collection: 'activityrecettes',    days: options.daysLogsApp ?? 7 },
    ],
    LaStreet: [
      { collection: 'leadresponses',       days: options.daysLogsApp ?? 30 },
    ],
  };

  const apps = getAppNames();
  const results = [];

  for (const appName of apps) {
    try {
      const db = getTenantDB(appName);
      const appRules = APP_RULES[appName] || [];

      // Nettoyer les logs communs (Log + AuditLog)
      const commonResult = await cleanAppLogs(db, appName, COMMON_RULES);
      results.push(commonResult);

      // Nettoyer les logs spécifiques à l'application
      if (appRules.length > 0) {
        const appResult = await cleanAppLogs(db, `${appName} (spécifique)`, appRules);
        results.push(appResult);
      }
    } catch (err) {
      results.push({
        app: appName,
        deleted: 0,
        details: [{ status: `erreur: ${err.message}` }],
      });
    }
  }

  return {
    startedAt,
    completedAt: new Date(),
    results,
    totalDeleted: results.reduce((sum, r) => sum + (r.deleted || 0), 0),
  };
};

module.exports = { runDataRetention };
