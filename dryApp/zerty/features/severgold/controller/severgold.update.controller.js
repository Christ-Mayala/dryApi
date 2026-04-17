const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SevergoldSchema = require('../model/severgold.schema');

// UPDATE - met a jour un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Severgold', SevergoldSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!item) throw new Error('Severgold introuvable');
  return sendResponse(res, item, 'Severgold mis a jour');
});
