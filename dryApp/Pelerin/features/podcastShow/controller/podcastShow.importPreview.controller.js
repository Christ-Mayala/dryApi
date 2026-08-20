const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { fetchAndNormalizeFeed } = require('../../../services/podcastRss.service');
const PodcastShowSchema = require('../model/podcastShow.schema');

// POST /podcastShow/import/preview — admin. Analyse un flux RSS SANS rien
// écrire : l'administrateur vérifie les informations avant de publier.
module.exports = asyncHandler(async (req, res) => {
  const rssUrl = String(req.body?.rssUrl || '').trim();
  if (!/^https?:\/\//i.test(rssUrl)) {
    throw httpError('rssUrl invalide (URL http(s) requise)', 400);
  }

  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const existing = await Show.findOne({ rssUrl }).select('_id title syncStatus');

  const { show, episodes } = await fetchAndNormalizeFeed(rssUrl);

  return sendResponse(
    res,
    {
      ...show,
      alreadyImported: Boolean(existing),
      existingId: existing ? String(existing._id) : null,
      existingTitle: existing?.title || null,
      episodeCount: episodes.length,
      // Aperçu limité (20) — suffisant pour valider avant publication.
      episodes: episodes.slice(0, 20).map((e) => ({
        guid: e.guid,
        title: e.title,
        publishedAt: e.publishedAt,
        duration: e.duration,
        audioUrl: e.audioUrl,
      })),
    },
    'Aperçu du flux RSS',
  );
});
