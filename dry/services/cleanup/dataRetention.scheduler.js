/**
 * Data Retention Scheduler
 * Planifie le nettoyage automatique des logs et données temporaires.
 *
 * Configuration :
 *   RETENTION_ENABLED  = true/false        (défaut: true)
 *   RETENTION_CRON     = Expression CRON   (défaut: '0 4 * * *' → 4h du matin)
 *   + toutes les variables RETENTION_DAYS_* pour les durées de rétention
 */

const cron = require('node-cron');
const { runDataRetention } = require('./dataRetention.service');

const config = require('../../../config/database');

// ─── Helpers de parsing ─────────────────────────────────────────────────────

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

// ─── État ───────────────────────────────────────────────────────────────────

let started = false;
let running = false;

// ─── Exécution ──────────────────────────────────────────────────────────────

const runDataRetentionNow = async () => {
  if (running) {
    console.log('[RETENTION] ⏳ Déjà en cours, exécution ignorée.');
    return;
  }
  running = true;

  try {
    console.log('[RETENTION] 🧹 Nettoyage des logs et données temporaires...');

    const result = await runDataRetention({
      daysLog: parsePositiveInt(config.RETENTION_DAYS_LOG, 7),
      daysAudit: parsePositiveInt(config.RETENTION_DAYS_AUDIT, 7),
      daysRequests: parsePositiveInt(config.RETENTION_DAYS_REQUESTS, 7),
      daysConversations: parsePositiveInt(config.RETENTION_DAYS_CONVERSATIONS, 30),
      daysMessages: parsePositiveInt(config.RETENTION_DAYS_MESSAGES, 30),
      daysViews: parsePositiveInt(config.RETENTION_DAYS_VIEWS, 7),
      daysLogsApp: parsePositiveInt(config.RETENTION_DAYS_LOGS_APP, 30),
    });

    const total = result.totalDeleted || 0;
    console.log(`[RETENTION] ✅ ${total} document(s) supprimé(s)`);

    // Log détaillé des résultats par application
    if (total > 0 && result.results?.length) {
      for (const r of result.results) {
        if (r.deleted > 0 && r.details?.length) {
          const cols = r.details
            .filter((d) => d.deleted > 0)
            .map((d) => `${d.collection}: ${d.deleted}`)
            .join(', ');
          if (cols) {
            console.log(`  ├ ${r.app} → ${cols}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[RETENTION] ❌ Erreur: ${error?.message || error}`);
  } finally {
    running = false;
  }
};

// ─── Initialisation du scheduler ────────────────────────────────────────────

const startDataRetentionScheduler = () => {
  if (started) return;
  started = true;

  const enabled = parseBool(config.RETENTION_ENABLED, true);
  if (!enabled) {
    console.log('[RETENTION] ⏸️  Désactivé par configuration');
    return;
  }

  const expression = String(config.RETENTION_CRON || '0 4 * * *').trim();
  const task = cron.schedule(expression, () => {
    runDataRetentionNow().catch(() => {});
  });

  // Premier run 30 secondes après le démarrage du serveur
  setTimeout(() => {
    runDataRetentionNow().catch(() => {});
  }, 30000).unref();

  console.log(`[RETENTION] 🧹 Planifié: ${expression}`);
  return task;
};

module.exports = {
  startDataRetentionScheduler,
  runDataRetentionNow,
};
