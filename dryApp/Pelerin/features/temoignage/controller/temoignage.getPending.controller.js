const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const TemoignageSchema = require('../model/temoignage.schema');

// GET /temoignage/pending — file de moderation (admin uniquement, cf. route: authorize('admin')).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const items = await Model.find({ isApproved: false }).sort({ createdAt: -1 });
  return sendResponse(res, items, 'Temoignages en attente recuperes');
});
