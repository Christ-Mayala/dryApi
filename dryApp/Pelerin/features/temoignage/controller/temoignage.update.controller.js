const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const TemoignageSchema = require('../model/temoignage.schema');

// L'auteur peut modifier son temoignage tant qu'il n'est pas encore approuve.
// Seul l'admin peut modifier isApproved/isFeatured (moderation) ou editer apres coup.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw httpError('Temoignage introuvable', 404);

  const isOwner = String(item.authorUserId) === String(req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !(isOwner && !item.isApproved)) {
    throw httpError('Non autorise a modifier ce temoignage', 403);
  }

  const { title, authorName, before, encounter, after, images, audioUrl, category } = req.body;
  if (title !== undefined) item.title = title;
  if (authorName !== undefined) item.authorName = authorName;
  if (before !== undefined) item.before = before;
  if (encounter !== undefined) item.encounter = encounter;
  if (after !== undefined) item.after = after;
  if (images !== undefined) item.images = images;
  if (audioUrl !== undefined) item.audioUrl = audioUrl;
  if (category !== undefined) item.category = category;

  if (isAdmin) {
    if (req.body.isApproved !== undefined) item.isApproved = req.body.isApproved;
    if (req.body.isFeatured !== undefined) item.isFeatured = req.body.isFeatured;
  }

  item.updatedBy = req.user.id;
  await item.save();

  return sendResponse(res, item, 'Temoignage mis a jour');
});
