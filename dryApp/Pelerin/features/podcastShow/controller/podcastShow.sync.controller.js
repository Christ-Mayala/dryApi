const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { syncPodcastShow } = require('../../../services/podcastRssSync.service');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../podcastEpisode/model/podcastEpisode.schema');

// POST /podcastShow/:id/sync — admin. « Synchroniser maintenant » : relit le
// flux RSS, insère les nouveaux épisodes, met à jour métadonnées + statut.
module.exports = asyncHandler(async (req, res) => {
  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);

  const show = await Show.findById(req.params.id);
  if (!show) throw httpError('Émission introuvable', 404);
  if (!show.rssUrl) throw httpError('Ce podcast n’a pas de flux RSS', 400);

  try {
    const updated = await syncPodcastShow({ Show, Episode, show });
    return sendResponse(res, updated, 'Podcast synchronisé');
  } catch (err) {
    // syncPodcastShow a déjà enregistré syncStatus='error' sur le document.
    return sendResponse(
      res,
      null,
      `RSS inaccessible : ${String(err?.message || err).slice(0, 200)}`,
      false,
      undefined,
      502,
    );
  }
});
