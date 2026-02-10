const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BienSchema = require('../model/biens.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Bien', BienSchema);
  const payload = { status: 'deleted' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Bien introuvable');
  return sendResponse(res, item, 'Bien supprime');
});
