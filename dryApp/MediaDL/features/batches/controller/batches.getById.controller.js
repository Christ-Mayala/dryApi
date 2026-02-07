const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BatchesSchema = require('../model/batches.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Batches', BatchesSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Batches introuvable');
  return sendResponse(res, item, 'Batches recupere');
});
