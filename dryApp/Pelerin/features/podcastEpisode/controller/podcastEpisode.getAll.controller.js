const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');

// GET /podcastEpisode?showId=&season=&page=&limit= — public, episodes publies.
// Paginé côté backend (page/limit) : l'écran d'une émission à 300+ épisodes
// ne télécharge plus tout d'un coup.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const filter = { isPublished: true };
  if (req.query.showId) filter.showId = req.query.showId;
  if (req.query.season) filter.season = Number(req.query.season);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

  const total = await Model.countDocuments(filter);
  const episodes = await Model.find(filter)
    .sort({ season: -1, episodeNumber: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return sendResponse(
    res,
    episodes,
    'Épisodes récupérés',
    true,
    { page, limit, total, totalPages: Math.ceil(total / limit) },
  );
});
