const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PresetsSchema = require('../model/presets.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Presets', PresetsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Presets introuvable');
  return sendResponse(res, item, 'Presets recupere');
});
