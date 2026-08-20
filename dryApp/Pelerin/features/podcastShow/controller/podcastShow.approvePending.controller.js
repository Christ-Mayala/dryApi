const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { recordPipelineDecision } = require('../../../services/podcastPipeline.service');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastImportDecisionSchema = require('../model/podcastImportDecision.schema');

// POST /podcastShow/admin/approve-pending — admin. Approuve en UNE action tous
// les podcasts du pipeline en attente (autoPublishStatus='pending') dont le
// score de pertinence est >= minScore (défaut 65). Chaque approbation est
// consignée dans l'historique du pipeline, comme une modération manuelle.
// Corps : { minScore?: number }
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastShow', PodcastShowSchema);
  const Decision = req.getModel('PodcastImportDecision', PodcastImportDecisionSchema);

  const minScore = Math.max(0, Math.min(100, Number(req.body?.minScore) || 65));

  const pending = await Model.find({ autoPublishStatus: 'pending', isPublished: false, score: { $gte: minScore } });

  let approved = 0;
  const shows = [];
  for (const show of pending) {
    show.autoPublishStatus = 'manual';
    show.isPublished = true;
    show.moderationReason = null;
    await show.save();

    await recordPipelineDecision({
      Decision,
      show,
      decision: { status: 'manual' },
      source: 'moderation',
      action: 'approve',
      reason: `Approbation groupée (score ≥ ${minScore})`,
      moderatedBy: req.user?.id || req.user?._id,
    });
    approved += 1;
    shows.push(show);
  }

  return sendResponse(res, { approved, minScore, shows }, 'Podcasts en attente approuvés');
});
