const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PostSchema = require('../model/post.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Post', PostSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Post introuvable');
  return sendResponse(res, item, 'Post recupere');
});
