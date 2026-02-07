const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const { id } = req.params;
  const updated = await Professional.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  if (!updated) throw new Error('Professionnel introuvable');

  return sendResponse(res, updated, 'Professionnel supprimé');
});
