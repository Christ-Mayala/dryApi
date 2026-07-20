const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const AudioTrackSchema = require('../model/audioTrack.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const track = await Model.findById(req.params.id);
  if (!track) throw httpError('Piste introuvable', 404);
  return sendResponse(res, track, 'Piste récupérée');
});
