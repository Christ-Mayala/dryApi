const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const TemoignageSchema = require('../model/temoignage.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw httpError('Temoignage introuvable', 404);

  const isOwner = String(item.authorUserId) === String(req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !isOwner) throw httpError('Non autorise', 403);

  item.status = 'deleted';
  item.updatedBy = req.user.id;
  await item.save();

  return sendResponse(res, null, 'Temoignage supprime');
});
