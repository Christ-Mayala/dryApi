const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SevergoldSchema = require('../model/severgold.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Severgold', SevergoldSchema);
  const payload = { status: 'deleted' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Severgold introuvable');
  return sendResponse(res, item, 'Severgold supprime');
});
