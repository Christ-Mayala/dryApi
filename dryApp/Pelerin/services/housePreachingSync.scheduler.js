/**
 * Scheduler de synchronisation YouTube pour les Prédications de la Maison
 * (dryApp/Pelerin).
 *
 * Toute la récupération est centralisée ici (cron node-cron) et réutilise le
 * service existant housePreachingSync.service.js — aucune duplication de
 * logique. Le mobile ne parle jamais à YouTube directement.
 *
 * Configuration :
 *   YOUTUBE_SYNC_ENABLED   = true/false   (défaut: true)
 *   YOUTUBE_SYNC_CRON      = expression   (défaut: toutes les heures)
 *
 * Désactivé automatiquement quand NODE_ENV=test afin de ne pas perturber les
 * tests. Un flag `running` évite les passes concurrentes ; chaque source est
 * isolée (une source en erreur ne bloque pas les autres).
 *
 * NB : la passe est économe en quota (arrêt précoce dès qu'une page est déjà
 * connue + durées uniquement pour les nouvelles vidéos), donc 1h est sans
 * risque même pour des chaînes très actives comme ICCTV.
 */
const cron = require('node-cron');
const getModel = require('../../../dry/core/factories/modelFactory');

const HOUSE_PREACHING_APP = 'Pelerin';
const { syncFromYouTube } = require('./housePreachingSync.service');
const HousePreachingSchema = require('../features/housePreaching/model/housePreaching.schema');
const HousePreachingSourceSchema = require('../features/housePreaching/model/housePreachingSource.schema');

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

let started = false;
let running = false;

/**
 * Exécute la synchronisation maintenant (appelable manuellement et par le cron).
 * @returns {Promise<object>} rapport { synced, created, updated, errors, message? }
 */
async function runHousePreachingSyncNow() {
  if (running) {
    console.log('[HOUSE-PREACHING-SYNC] ⏳ Déjà en cours, exécution ignorée.');
    return { synced: 0, created: 0, updated: 0, errors: 0, message: 'Déjà en cours' };
  }
  running = true;
  try {
    const HousePreaching = getModel(HOUSE_PREACHING_APP, 'HousePreaching', HousePreachingSchema);
    const HousePreachingSource = getModel(
      HOUSE_PREACHING_APP,
      'HousePreachingSource',
      HousePreachingSourceSchema
    );
    const result = await syncFromYouTube(HousePreaching, HousePreachingSource);
    console.log(
      `[HOUSE-PREACHING-SYNC] ✅ ${result.synced} synchronisée(s) (${result.created} créée(s), ` +
        `${result.updated} mise(s) à jour, ${result.errors} erreur(s))` +
        (result.message ? ` — ${result.message}` : ''),
    );
    return result;
  } catch (err) {
    console.error('[HOUSE-PREACHING-SYNC] ❌ Erreur globale:', err.message);
    return { synced: 0, created: 0, updated: 0, errors: 1, message: err.message };
  } finally {
    running = false;
  }
}

/**
 * Démarre le scheduler (idempotent). Ne fait RIEN si :
 *   - NODE_ENV === 'test' (ne pas perturber les tests) ;
 *   - YOUTUBE_SYNC_ENABLED === 'false'.
 * L'absence de clé YouTube n'empêche pas le démarrage : le service renvoie un
 * message explicite sans planter (syncStatus resté à l'état précédent).
 */
function startHousePreachingSyncScheduler() {
  if (started) return;
  started = true;

  if (process.env.NODE_ENV === 'test') {
    console.log('[HOUSE-PREACHING-SYNC] ℹ️  Désactivé (NODE_ENV=test).');
    return;
  }

  if (!parseBool(process.env.YOUTUBE_SYNC_ENABLED, true)) {
    console.log('[HOUSE-PREACHING-SYNC] ℹ️  Désactivé (YOUTUBE_SYNC_ENABLED=false).');
    return;
  }

  const expression = process.env.YOUTUBE_SYNC_CRON || '0 * * * *';
  if (!cron.validate(expression)) {
    console.error(`[HOUSE-PREACHING-SYNC] ❌ Expression cron invalide : ${expression} — scheduler non démarré.`);
    return;
  }

  cron.schedule(expression, runHousePreachingSyncNow, { timezone: 'Europe/Paris' });
  console.log(`[HOUSE-PREACHING-SYNC] 🕐 Scheduler YouTube planifié (${expression})`);
}

module.exports = {
  startHousePreachingSyncScheduler,
  runHousePreachingSyncNow,
  HOUSE_PREACHING_APP,
};
