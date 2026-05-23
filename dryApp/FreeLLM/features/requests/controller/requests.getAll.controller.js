const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const RequestsSchema = require('../model/requests.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Requests', RequestsSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null });
  return sendResponse(res, items, 'Requests liste');
});
