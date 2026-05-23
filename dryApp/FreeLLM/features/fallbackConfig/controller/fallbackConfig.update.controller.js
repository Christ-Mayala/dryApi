const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const FallbackConfigSchema = require('../model/fallbackConfig.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('FallbackConfig', FallbackConfigSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user?.id },
    { new: true }
  );
  if (!item) {
    res.status(404);
    throw new Error('FallbackConfig non trouve');
  }
  return sendResponse(res, item, 'FallbackConfig mis a jour');
});
