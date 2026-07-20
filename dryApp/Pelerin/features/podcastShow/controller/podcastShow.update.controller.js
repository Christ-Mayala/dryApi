const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const { deleteCloudinaryAsset } = require('../../../services/cloudinaryCleanup.service');
const PodcastShowSchema = require('../model/podcastShow.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const show = await Model.findById(req.params.id).select('+coverPublicId');
  if (!show) throw httpError('Émission introuvable', 404);

  Object.assign(show, pickDefined(req.body, ['title', 'description', 'author', 'category']));
  if (req.body.isPublished !== undefined) {
    show.isPublished = req.body.isPublished === 'true' || req.body.isPublished === true;
  }

  const cover = req.files?.cover?.[0];
  if (cover) {
    await deleteCloudinaryAsset(show.coverPublicId, 'image');
    show.coverUrl = cover.path;
    show.coverPublicId = cover.filename;
  }

  await show.save();
  return sendResponse(res, show, 'Émission mise à jour');
});
