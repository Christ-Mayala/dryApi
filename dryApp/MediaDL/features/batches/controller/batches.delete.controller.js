const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BatchesSchema = require('../model/batches.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Batches', BatchesSchema);
  const payload = { status: 'inactive' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Batches introuvable');
  return sendResponse(res, item, 'Batches desactive');
});
