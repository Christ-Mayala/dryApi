const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { fetchPipelineHistory } = require('../../../services/podcastPipeline.service');
const PodcastImportDecisionSchema = require('../model/podcastImportDecision.schema');

// GET /podcastShow/admin/pipeline — admin. Historique des décisions du
// pipeline d'import automatique (du plus récent au plus ancien), avec le
// détail du score par critère. Filtres optionnels :
//   ?status=auto|pending|rejected|manual   (décision appliquée)
//   ?source=auto|discover|manual|moderation (origine de la décision)
//   ?showId=<id>                            (un podcast précis)
//   ?limit=<nombre>                         (défaut 100, plafond 500)
module.exports = asyncHandler(async (req, res) => {
  const Decision = req.getModel('PodcastImportDecision', PodcastImportDecisionSchema);

  const { status, source, showId, limit } = req.query;
  const decisions = await fetchPipelineHistory({
    Decision,
    status,
    source,
    showId,
    limit,
  });

  return sendResponse(res, decisions, 'Historique du pipeline récupéré');
});
