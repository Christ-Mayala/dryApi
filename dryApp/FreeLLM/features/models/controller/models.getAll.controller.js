const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ModelsSchema = require('../model/models.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Models', ModelsSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null });
  return sendResponse(res, items, 'Models liste');
});
