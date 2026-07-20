const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');

// GET /podcastEpisode/admin/all?showId= — admin uniquement, tous les episodes.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const filter = {};
  if (req.query.showId) filter.showId = req.query.showId;

  const episodes = await Model.find(filter).sort({ season: -1, episodeNumber: -1 }).limit(300);
  return sendResponse(res, episodes, 'Épisodes récupérés (admin)');
});
