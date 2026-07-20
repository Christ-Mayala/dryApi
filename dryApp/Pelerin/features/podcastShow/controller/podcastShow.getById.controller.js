const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastShowSchema = require('../model/podcastShow.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const show = await Model.findById(req.params.id);
  if (!show) throw httpError('Émission introuvable', 404);
  return sendResponse(res, show, 'Émission récupérée');
});
