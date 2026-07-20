const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastShowSchema = require('../model/podcastShow.schema');

// GET /podcastShow/admin/all — admin uniquement, toutes les emissions (publiees ou non).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const shows = await Model.find({}).sort({ createdAt: -1 }).limit(200);
  return sendResponse(res, shows, 'Émissions récupérées (admin)');
});
