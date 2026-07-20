const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ParcoursProgressSchema = require('../model/parcoursProgress.schema');

// GET /parcoursprogress/:parcoursId — renvoie ma progression, ou un objet
// "non commence" par defaut (pas encore de document en base).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ParcoursProgress', ParcoursProgressSchema);
  const item = await Model.findOne({
    createdBy: req.user.id,
    parcoursId: req.params.parcoursId,
  });

  if (!item) {
    return sendResponse(res, {
      parcoursId: req.params.parcoursId,
      currentStepOrder: 0,
      completedSteps: [],
      startedAt: null,
      completedAt: null,
    }, 'Parcours pas encore commence');
  }

  return sendResponse(res, item, 'Progression recuperee');
});
