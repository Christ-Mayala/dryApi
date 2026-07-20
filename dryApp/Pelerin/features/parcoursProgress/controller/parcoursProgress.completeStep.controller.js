const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const ParcoursProgressSchema = require('../model/parcoursProgress.schema');
const ParcoursSchema = require('../../parcours/model/parcours.schema');

// POST /parcoursprogress/:parcoursId/complete-step  { stepOrder }
// Marque une etape comme terminee, avance currentStepOrder, et marque le
// parcours complet si toutes les etapes definies ont ete franchies.
module.exports = asyncHandler(async (req, res) => {
  const { stepOrder } = req.body;
  if (!stepOrder || stepOrder < 1) throw httpError('stepOrder est requis (entier >= 1)', 400);

  const ParcoursModel = req.getModel('Parcours', ParcoursSchema);
  const parcours = await ParcoursModel.findById(req.params.parcoursId);
  if (!parcours) throw httpError('Parcours introuvable', 404);

  const ProgressModel = req.getModel('ParcoursProgress', ParcoursProgressSchema);
  let progress = await ProgressModel.findOne({
    createdBy: req.user.id,
    parcoursId: req.params.parcoursId,
  });

  if (!progress) {
    progress = await ProgressModel.create({
      parcoursId: req.params.parcoursId,
      createdBy: req.user.id,
      completedSteps: [],
      currentStepOrder: 1,
    });
  }

  if (!progress.completedSteps.includes(stepOrder)) {
    progress.completedSteps.push(stepOrder);
  }
  progress.currentStepOrder = Math.max(progress.currentStepOrder, stepOrder + 1);
  progress.updatedBy = req.user.id;

  const totalSteps = parcours.steps.length;
  if (totalSteps > 0 && progress.completedSteps.length >= totalSteps && !progress.completedAt) {
    progress.completedAt = new Date();
  }

  await progress.save();

  return sendResponse(res, progress, 'Etape validee');
});
