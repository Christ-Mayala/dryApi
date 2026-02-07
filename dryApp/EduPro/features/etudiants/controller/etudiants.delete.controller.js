const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const EtudiantSchema = require('../model/etudiants.schema');

// DELETE - desactive un element (soft delete)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Etudiant', EtudiantSchema);
  const payload = { status: 'inactive' };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) throw new Error('Etudiant introuvable');
  return sendResponse(res, item, 'Etudiant desactive');
});
