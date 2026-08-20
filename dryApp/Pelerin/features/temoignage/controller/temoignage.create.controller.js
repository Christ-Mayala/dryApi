const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const TemoignageSchema = require('../model/temoignage.schema');
const {
  categorizeTemoignage,
  isValidTemoignageCategory,
} = require('../../../services/temoignageCategorization.service');

// Un utilisateur connecte soumet son propre temoignage. Toujours en attente de
// moderation (isApproved:false) et jamais "featured" via cette route.
// La categorie est deduite automatiquement du contenu si non fournie ou invalide.
module.exports = asyncHandler(async (req, res) => {
  const { title, authorName, before, encounter, after, images, audioUrl, category } = req.body;
  if (!title || !before || !encounter || !after) {
    throw httpError('title, before, encounter et after sont requis', 400);
  }

  const finalCategory = isValidTemoignageCategory(category)
    ? category
    : categorizeTemoignage(`${title} ${before} ${encounter} ${after}`);

  const Model = req.getModel('Temoignage', TemoignageSchema);
  const item = await Model.create({
    title,
    authorName: String(authorName || 'Anonyme').trim().slice(0, 80),
    authorUserId: req.user.id,
    before,
    encounter,
    after,
    images: images || [],
    audioUrl,
    category: finalCategory,
    isApproved: false,
    isFeatured: false,
    createdBy: req.user.id,
  });

  return sendResponse(res, item, 'Temoignage soumis, en attente de moderation');
});
