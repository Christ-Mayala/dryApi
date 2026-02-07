const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const DownloadsSchema = require('../model/downloads.schema');

// CREATE - cree un element
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Downloads', DownloadsSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'Downloads cree');
});
