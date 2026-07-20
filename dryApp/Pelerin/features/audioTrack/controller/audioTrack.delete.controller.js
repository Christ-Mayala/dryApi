const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { deleteCloudinaryAsset } = require('../../../services/cloudinaryCleanup.service');
const AudioTrackSchema = require('../model/audioTrack.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const track = await Model.findById(req.params.id).select('+audioPublicId +coverPublicId');
  if (!track) throw httpError('Piste introuvable', 404);

  await Promise.all([
    deleteCloudinaryAsset(track.audioPublicId, 'video'),
    deleteCloudinaryAsset(track.coverPublicId, 'image'),
  ]);
  await track.deleteOne();

  return sendResponse(res, null, 'Piste supprimée');
});
