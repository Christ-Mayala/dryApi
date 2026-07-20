const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const { deleteCloudinaryAsset } = require('../../../services/cloudinaryCleanup.service');
const AudioTrackSchema = require('../model/audioTrack.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const track = await Model.findById(req.params.id).select('+audioPublicId +coverPublicId');
  if (!track) throw httpError('Piste introuvable', 404);

  const audioFile = req.files?.audio?.[0];
  const coverFile = req.files?.cover?.[0];
  const linkUrl = (req.body.url || '').trim();

  Object.assign(track, pickDefined(req.body, ['title', 'artist', 'category', 'duration']));

  if (audioFile) {
    await deleteCloudinaryAsset(track.audioPublicId, 'video');
    track.url = audioFile.path;
    track.audioPublicId = audioFile.filename;
  } else if (linkUrl) {
    await deleteCloudinaryAsset(track.audioPublicId, 'video');
    track.url = linkUrl;
    track.audioPublicId = undefined;
  }

  if (coverFile) {
    await deleteCloudinaryAsset(track.coverPublicId, 'image');
    track.coverUrl = coverFile.path;
    track.coverPublicId = coverFile.filename;
  } else if (req.body.coverUrl !== undefined) {
    track.coverUrl = req.body.coverUrl.trim() || undefined;
  }

  await track.save();
  return sendResponse(res, track, 'Piste mise à jour');
});
