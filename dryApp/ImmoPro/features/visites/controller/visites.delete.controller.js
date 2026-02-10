const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const VisiteSchema = require('../model/visites.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Visite', VisiteSchema);
  const payload = { status: 'deleted' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Visite introuvable');
  return sendResponse(res, item, 'Visite supprime');
});
