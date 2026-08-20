const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const TemoignageSchema = require('../model/temoignage.schema');
const { createNotification } = require('../../../services/notifications.service');

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

  // Capture l'état d'approbation AVANT toute modification (pour ne notifier
  // qu'à la transition non-approuvé → approuvé).
  const wasApproved = Boolean(item.isApproved);

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

  // Événement réel : quand un admin approuve un témoignage (transition
  // non-approuvé → approuvé), son auteur est notifié dans l'inbox
  // (GET /notifications). Attendu (try/catch) pour que la notification soit
  // visible immédiatement, sans jamais faire échouer la modération.
  if (isAdmin && req.body.isApproved === true && !wasApproved) {
    const authorId = item.authorUserId || item.createdBy;
    if (authorId) {
      try {
        await createNotification({
          userId: String(authorId),
          title: 'Ton témoignage a été publié 🎉',
          body: `« ${item.title} » est maintenant visible par tous. Merci de partager ton parcours !`,
          type: 'temoignage',
          link: `/temoignages/${item._id}`,
          getModel: req.getModel,
        });
      } catch (_) {
        // La notification ne doit jamais bloquer la réponse de modération
      }
    }
  }

  return sendResponse(res, item, 'Temoignage mis a jour');
});
