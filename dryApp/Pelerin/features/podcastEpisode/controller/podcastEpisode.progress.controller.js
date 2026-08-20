const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');
const PodcastListenSchema = require('../model/podcastListen.schema');

// PUT /podcastEpisode/progress/:id — enregistre la progression d'écoute.
// Appelé de façon raisonnable par l'app (toutes les ~20s, à la pause, à la
// fermeture du lecteur, à la fin de l'épisode) — jamais à chaque seconde.
module.exports.upsert = asyncHandler(async (req, res) => {
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Listen = req.getModel('PodcastListen', PodcastListenSchema);

  const episode = await Episode.findById(req.params.id).select('showId');
  if (!episode) throw httpError('Épisode introuvable', 404);

  const positionMs = Math.max(0, Number(req.body?.positionMs) || 0);
  const durationMs = Math.max(0, Number(req.body?.durationMs) || 0);
  const completed = Boolean(req.body?.completed);

  await Listen.findOneAndUpdate(
    { userId: req.user._id, episodeId: episode._id },
    {
      $set: {
        userId: req.user._id,
        showId: episode.showId,
        episodeId: episode._id,
        positionMs,
        durationMs,
        completed: completed || (durationMs > 0 && positionMs >= durationMs * 0.98),
        lastPlayedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // Popularité : une écoute réelle (position > 30s ou terminée) incrémente le
  // compteur, borné pour éviter tout abus de refresh.
  if (positionMs > 30000 || completed) {
    await Episode.updateOne(
      { _id: episode._id, playCount: { $lt: 100000 } },
      { $inc: { playCount: 1 } },
    );
  }

  return sendResponse(res, { episodeId: String(episode._id), saved: true }, 'Progression enregistrée');
});

// GET /podcastEpisode/progress/:id — ma progression pour un épisode (reprise
// multi-appareils ; la reprise locale reste instantanée via SQLite).
module.exports.getOne = asyncHandler(async (req, res) => {
  const Listen = req.getModel('PodcastListen', PodcastListenSchema);
  const listen = await Listen.findOne({ userId: req.user._id, episodeId: req.params.id });
  return sendResponse(res, listen || null, 'Progression');
});
