const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ClientSchema = require('../model/clients.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Client', ClientSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Client introuvable');
  return sendResponse(res, item, 'Client recupere');
});
