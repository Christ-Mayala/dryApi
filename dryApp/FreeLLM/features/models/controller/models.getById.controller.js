const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ModelsSchema = require('../model/models.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Models', ModelsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Models non trouve');
  }
  return sendResponse(res, item, 'Models recupere');
});
