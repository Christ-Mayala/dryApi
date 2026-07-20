const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const episode = await Model.findById(req.params.id);
  if (!episode) throw httpError('Épisode introuvable', 404);
  return sendResponse(res, episode, 'Épisode récupéré');
});
