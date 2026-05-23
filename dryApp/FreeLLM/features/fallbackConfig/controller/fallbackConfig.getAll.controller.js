const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const FallbackConfigSchema = require('../model/fallbackConfig.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('FallbackConfig', FallbackConfigSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null }).sort({ priority: 1 });
  return sendResponse(res, items, 'FallbackConfig liste');
});
