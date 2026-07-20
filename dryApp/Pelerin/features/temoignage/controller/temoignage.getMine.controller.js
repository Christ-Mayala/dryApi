const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const TemoignageSchema = require('../model/temoignage.schema');

// GET /temoignage/mine — mes propres soumissions, quel que soit leur statut.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const items = await Model.find({ authorUserId: req.user.id }).sort({ createdAt: -1 });
  return sendResponse(res, items, 'Mes temoignages recuperes');
});
