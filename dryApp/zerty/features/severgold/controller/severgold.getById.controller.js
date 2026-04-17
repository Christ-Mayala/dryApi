const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SevergoldSchema = require('../model/severgold.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Severgold', SevergoldSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Severgold introuvable');
  return sendResponse(res, item, 'Severgold recupere');
});
