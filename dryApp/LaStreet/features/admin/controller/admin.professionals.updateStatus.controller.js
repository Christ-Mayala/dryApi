const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const { id } = req.params;
  const { approvalStatus } = req.body || {};

  if (!['pending', 'approved', 'rejected'].includes(String(approvalStatus))) {
    throw new Error('approvalStatus invalide');
  }

  const updated = await Professional.findByIdAndUpdate(id, { approvalStatus }, { new: true });
  if (!updated) throw new Error('Professionnel introuvable');

  return sendResponse(res, updated, 'Statut mis à jour');
});
