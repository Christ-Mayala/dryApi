const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');

// GET /podcastEpisode?showId=&season= — public, episodes publies uniquement.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const filter = { isPublished: true };
  if (req.query.showId) filter.showId = req.query.showId;
  if (req.query.season) filter.season = Number(req.query.season);

  const episodes = await Model.find(filter).sort({ season: -1, episodeNumber: -1 }).limit(200);
  return sendResponse(res, episodes, 'Épisodes récupérés');
});
