const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastShowSchema = require('../model/podcastShow.schema');

// GET /podcastShow/admin/all — admin uniquement, toutes les emissions
// (publiees ou non). Filtres optionnels :
//   ?autoStatus=auto|pending|rejected|manual   (pipeline d'import automatique)
//   ?published=true|false
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);

  const query = {};
  const { autoStatus, published } = req.query;
  if (autoStatus && ['manual', 'auto', 'pending', 'rejected'].includes(String(autoStatus))) {
    query.autoPublishStatus = String(autoStatus);
  }
  if (published !== undefined && published !== '') {
    query.isPublished = published === 'true' || published === '1';
  }

  const shows = await Model.find(query).sort({ createdAt: -1 }).limit(200);
  return sendResponse(res, shows, 'Émissions récupérées (admin)');
});
