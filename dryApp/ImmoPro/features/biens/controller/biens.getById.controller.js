const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BienSchema = require('../model/biens.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Bien', BienSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Bien introuvable');
  return sendResponse(res, item, 'Bien recupere');
});
