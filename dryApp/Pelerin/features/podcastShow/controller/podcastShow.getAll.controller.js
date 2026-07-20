const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastShowSchema = require('../model/podcastShow.schema');

// GET /podcastShow — public, emissions publiees uniquement. ?category= pour filtrer.
// Voir podcastShow.getAllAdmin.controller.js pour la vue admin (toutes, y
// compris non publiees) — routes dediees plutot qu'une auth optionnelle, meme
// convention que temoignage (voir dryApp/Pelerin/README.md).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const filter = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;

  const shows = await Model.find(filter).sort({ createdAt: -1 }).limit(100);
  return sendResponse(res, shows, 'Émissions récupérées');
});
