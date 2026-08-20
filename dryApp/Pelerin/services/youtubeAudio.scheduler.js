/**
 * Scheduler de découverte « Audio chrétien YouTube » (dryApp/Pelerin).
 *
 * Cron quotidien qui peuple la bibliothèque Audio avec des titres chrétiens
 * trouvés automatiquement sur YouTube (louange, gospel, prédications,
 * enseignements) — via youtubeAudio.service.js (aucune logique dupliquée).
 *
 * Configuration :
 *   YOUTUBE_AUDIO_SYNC_ENABLED = true/false  (défaut: true)
 *   YOUTUBE_AUDIO_SYNC_CRON    = expression  (défaut: 0 5 * * *)
 *
 * Désactivé automatiquement quand NODE_ENV=test. Un flag `running` évite les
 * passes concurrentes. La recherche est mise en cache 6 h (quota Data API) :
 * le cron n'a donc d'effet qu'une fois par plage de 6 h.
 */
const cron = require('node-cron');
const getModel = require('../../../dry/core/factories/modelFactory');
const { syncYoutubeAudioTracks } = require('./youtubeAudio.service');
const AudioTrackSchema = require('../features/audioTrack/model/audioTrack.schema');

const AUDIO_APP = 'Pelerin';

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

let started = false;
let running = false;

/**
 * Exécute la découverte maintenant (cron + bouton admin).
 * @returns {Promise<object>} rapport
 */
async function runYoutubeAudioSyncNow() {
  if (running) {
    console.log('[YOUTUBE-AUDIO] ⏳ Déjà en cours, exécution ignorée.');
    return { imported: 0, skipped: 0, errors: 0, message: 'Déjà en cours' };
  }
  running = true;
  try {
    const Track = getModel(AUDIO_APP, 'AudioTrack', AudioTrackSchema);
    const result = await syncYoutubeAudioTracks(Track);
    console.log(
      `[YOUTUBE-AUDIO] ✅ ${result.imported} piste(s) ajoutée(s), ${result.skipped} ignorée(s)` +
        (result.message ? ` — ${result.message}` : ''),
    );
    return result;
  } catch (err) {
    console.error('[YOUTUBE-AUDIO] ❌ Erreur globale:', err.message);
    return { imported: 0, skipped: 0, errors: 1, message: err.message };
  } finally {
    running = false;
  }
}

/**
 * Démarre le scheduler (idempotent). Ne fait RIEN si NODE_ENV=test ou si
 * YOUTUBE_AUDIO_SYNC_ENABLED=false.
 */
function startYoutubeAudioScheduler() {
  if (started) return;
  started = true;

  if (process.env.NODE_ENV === 'test') {
    console.log('[YOUTUBE-AUDIO] ℹ️  Désactivé (NODE_ENV=test).');
    return;
  }

  if (!parseBool(process.env.YOUTUBE_AUDIO_SYNC_ENABLED, true)) {
    console.log('[YOUTUBE-AUDIO] ℹ️  Désactivé (YOUTUBE_AUDIO_SYNC_ENABLED=false).');
    return;
  }

  const expression = process.env.YOUTUBE_AUDIO_SYNC_CRON || '0 5 * * *';
  if (!cron.validate(expression)) {
    console.error(`[YOUTUBE-AUDIO] ❌ Expression cron invalide : ${expression} — scheduler non démarré.`);
    return;
  }

  cron.schedule(expression, runYoutubeAudioSyncNow, { timezone: 'Europe/Paris' });
  console.log(`[YOUTUBE-AUDIO] 🕐 Découverte audio YouTube planifiée (${expression})`);
}

module.exports = { startYoutubeAudioScheduler, runYoutubeAudioSyncNow, AUDIO_APP };
