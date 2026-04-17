const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SevergoldSchema = require('../model/severgold.schema');

// CREATE - cree un element
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Severgold', SevergoldSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'Severgold cree');
});
