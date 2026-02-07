const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const CoursSchema = require('../model/cours.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Cours', CoursSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Cours introuvable');
  return sendResponse(res, item, 'Cours recupere');
});
