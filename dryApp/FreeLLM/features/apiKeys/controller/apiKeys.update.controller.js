const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ApiKeysSchema = require('../model/apiKeys.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ApiKeys', ApiKeysSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user?.id },
    { new: true }
  );
  if (!item) {
    res.status(404);
    throw new Error('ApiKeys non trouve');
  }
  return sendResponse(res, item, 'ApiKeys mis a jour');
});
