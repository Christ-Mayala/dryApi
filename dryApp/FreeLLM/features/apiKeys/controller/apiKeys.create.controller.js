const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ApiKeysSchema = require('../model/apiKeys.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ApiKeys', ApiKeysSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'ApiKeys cree');
});
