const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const VisiteSchema = require('../model/visites.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Visite', VisiteSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Visite introuvable');
  return sendResponse(res, item, 'Visite recupere');
});
