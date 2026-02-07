const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const EtudiantSchema = require('../model/etudiants.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Etudiant', EtudiantSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Etudiant introuvable');
  return sendResponse(res, item, 'Etudiant recupere');
});
