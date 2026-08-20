const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { recordPipelineDecision } = require('../../../services/podcastPipeline.service');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastImportDecisionSchema = require('../model/podcastImportDecision.schema');

// POST /podcastShow/:id/moderate — admin. Modération fine d'un podcast du
// pipeline d'import automatique. Corps : { action, reason? }.
//
//   action = 'approve'    → autoPublishStatus='manual', publié (validation d'un
//                           podcast en attente, score 50–79).
//   action = 'reject'     → autoPublishStatus='rejected', non publié, motif
//                           optionnel conservé (podcast auto-publié ou en attente).
//   action = 'reactivate' → autoPublishStatus='manual', republié, motif effacé
//                           (podcast rejeté ou désactivé).
//
// Chaque action est consignée dans l'historique du pipeline (écran admin).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const Decision = req.getModel('PodcastImportDecision', PodcastImportDecisionSchema);

  const show = await Model.findById(req.params.id);
  if (!show) throw httpError('Émission introuvable', 404);

  const action = String(req.body?.action || '').trim();
  const reason = String(req.body?.reason || '').trim() || null;

  let decisionStatus;
  let recordedAction;
  if (action === 'approve') {
    decisionStatus = 'manual';
    recordedAction = 'approve';
    show.moderationReason = null;
  } else if (action === 'reject') {
    decisionStatus = 'rejected';
    recordedAction = 'reject';
    show.moderationReason = reason;
  } else if (action === 'reactivate') {
    decisionStatus = 'manual';
    recordedAction = 'reactivate';
    show.moderationReason = null;
  } else {
    throw httpError("action invalide — attendu : 'approve' | 'reject' | 'reactivate'", 400);
  }

  show.autoPublishStatus = decisionStatus;
  show.isPublished = decisionStatus === 'manual';
  await show.save();

  await recordPipelineDecision({
    Decision,
    show,
    decision: { status: decisionStatus },
    source: 'moderation',
    action: recordedAction,
    reason,
    moderatedBy: req.user?.id || req.user?._id,
  });

  return sendResponse(res, show, 'Émission modérée');
});
