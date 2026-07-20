const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const TemoignageSchema = require('../model/temoignage.schema');

// GET /temoignage/:id — public, uniquement si approuve.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const item = await Model.findOne({ _id: req.params.id, isApproved: true });
  if (!item) throw httpError('Temoignage introuvable', 404);
  return sendResponse(res, item, 'Temoignage recupere');
});
