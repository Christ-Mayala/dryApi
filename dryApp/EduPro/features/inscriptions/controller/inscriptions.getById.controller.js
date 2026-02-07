const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const InscriptionSchema = require('../model/inscriptions.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Inscription', InscriptionSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Inscription introuvable');
  return sendResponse(res, item, 'Inscription recupere');
});
