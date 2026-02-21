const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const EbooksSchema = require('../model/ebooks.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Ebooks', EbooksSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Ebooks introuvable');
  return sendResponse(res, item, 'Ebooks recupere');
});
