const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ApiKeysSchema = require('../model/apiKeys.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ApiKeys', ApiKeysSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null });
  return sendResponse(res, items, 'ApiKeys liste');
});
