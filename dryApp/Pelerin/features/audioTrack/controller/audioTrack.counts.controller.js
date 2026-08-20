const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AudioTrackSchema = require('../model/audioTrack.schema');

// GET /audioTrack/counts — public. Nombre de pistes par catégorie (les
// podcasts vivent dans leur propre onglet : exclus du comptage).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);
  const rows = await Model.aggregate([
    { $match: { category: { $in: ['gospel', 'louange', 'enseignement'] } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const counts = { gospel: 0, louange: 0, enseignement: 0, total: 0 };
  for (const r of rows) {
    if (counts[r._id] !== undefined) counts[r._id] = r.count;
  }
  counts.total = counts.gospel + counts.louange + counts.enseignement;
  return sendResponse(res, counts, 'Compteurs récupérés');
});
