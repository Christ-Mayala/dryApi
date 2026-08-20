const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { importPodcastFromRss } = require('../../../services/podcastImport.service');
const { recordPipelineDecision } = require('../../../services/podcastPipeline.service');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../podcastEpisode/model/podcastEpisode.schema');
const PodcastImportDecisionSchema = require('../model/podcastImportDecision.schema');

// POST /podcastShow/import — admin. Importe un podcast depuis son flux RSS :
// crée (ou met à jour si le rssUrl existe déjà) l'émission + ses épisodes,
// dédupliqués par guid. L'audio n'est jamais réhébergé.
//
// Le champ `source` distingue :
//   - 'manual'  (défaut) : action explicite de l'admin → toujours publié,
//     autoPublishStatus='manual'. Le score est calculé pour information.
//   - 'discover' : import depuis les résultats de découverte Podcast Index
//     → le score décide : ≥80 auto-publié, 50–79 en attente, <50 rejeté.
//   - 'auto'     : réservé à l'auto-découverte planifiée (même pipeline).
module.exports = asyncHandler(async (req, res) => {
  const rssUrl = String(req.body?.rssUrl || '').trim();
  if (!/^https?:\/\//i.test(rssUrl)) {
    throw httpError('rssUrl invalide (URL http(s) requise)', 400);
  }
  const category = String(req.body?.category || '').trim() || 'autre';
  const source = String(req.body?.source || 'manual').trim();
  const isPublished = req.body?.isPublished !== false;

  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Decision = req.getModel('PodcastImportDecision', PodcastImportDecisionSchema);

  const { show, created, decision } = await importPodcastFromRss({
    Show,
    Episode,
    rssUrl,
    category,
    isPublished,
    source,
  });

  // Consigne la décision du pipeline (uniquement quand le score a décidé :
  // source discover/auto). Un import manuel explicite n'est pas un événement
  // de pipeline.
  if (decision) {
    await recordPipelineDecision({
      Decision,
      show,
      decision,
      source,
      action: 'import',
      moderatedBy: req.user?.id || req.user?._id,
    });
  }

  const message = created ? 'Podcast importé' : 'Podcast mis à jour';
  return sendResponse(res, show, message, true, decision ?? undefined);
});
