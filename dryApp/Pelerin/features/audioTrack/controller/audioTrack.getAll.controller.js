const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AudioTrackSchema = require('../model/audioTrack.schema');

// GET /audioTrack — public. ?category= pour filtrer.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const filter = {};
  if (req.query.category) filter.category = req.query.category;

  const tracks = await Model.find(filter).sort({ createdAt: -1 }).limit(100);
  return sendResponse(res, tracks, 'Pistes récupérées');
});
