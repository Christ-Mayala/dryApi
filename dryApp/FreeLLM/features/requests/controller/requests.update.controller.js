const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const RequestsSchema = require('../model/requests.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Requests', RequestsSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user?.id },
    { new: true }
  );
  if (!item) {
    res.status(404);
    throw new Error('Requests non trouve');
  }
  return sendResponse(res, item, 'Requests mis a jour');
});
