const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BatchesSchema = require('../model/batches.schema');

// UPDATE - met a jour un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Batches', BatchesSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!item) throw new Error('Batches introuvable');
  return sendResponse(res, item, 'Batches mis a jour');
});
