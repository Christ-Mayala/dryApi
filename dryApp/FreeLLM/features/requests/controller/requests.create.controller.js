const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const RequestsSchema = require('../model/requests.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Requests', RequestsSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'Requests cree');
});
