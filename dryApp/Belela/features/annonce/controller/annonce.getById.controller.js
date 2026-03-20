const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AnnonceSchema = require('../model/annonce.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Annonce', AnnonceSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Annonce introuvable');
  return sendResponse(res, item, 'Annonce recupere');
});
