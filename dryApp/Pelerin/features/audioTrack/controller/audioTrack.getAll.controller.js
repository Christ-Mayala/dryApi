const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AudioTrackSchema = require('../model/audioTrack.schema');

// GET /audioTrack — public. ?category= pour filtrer.
// Les podcasts ne font PAS partie de la bibliothèque Audio (onglet dédié) :
// par défaut on exclut la catégorie 'podcast', sauf demande explicite.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const filter = req.query.category
    ? { category: req.query.category }
    : { category: { $ne: 'podcast' } };

  const tracks = await Model.find(filter).sort({ createdAt: -1 }).limit(100);
  return sendResponse(res, tracks, 'Pistes récupérées');
});
