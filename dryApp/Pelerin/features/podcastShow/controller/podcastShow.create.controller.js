const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const PodcastShowSchema = require('../model/podcastShow.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);

  const { title, description } = req.body;
  if (!title || !description) throw httpError('title et description sont requis', 400);

  const cover = req.files?.cover?.[0];

  const payload = {
    ...pickDefined(req.body, ['title', 'description', 'author', 'category']),
    isPublished: req.body.isPublished !== undefined ? req.body.isPublished === 'true' || req.body.isPublished === true : true,
  };
  if (cover) {
    payload.coverUrl = cover.path;
    payload.coverPublicId = cover.filename;
  }

  const show = await Model.create(payload);
  return sendResponse(res, show, 'Émission créée');
});
