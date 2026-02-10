const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ClientSchema = require('../model/clients.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Client', ClientSchema);
  const payload = { status: 'deleted' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Client introuvable');
  return sendResponse(res, item, 'Client supprime');
});
