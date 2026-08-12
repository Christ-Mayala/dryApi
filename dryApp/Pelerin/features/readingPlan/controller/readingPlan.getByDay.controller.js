const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const ReadingPlanSchema = require('../model/readingPlan.schema');

module.exports = asyncHandler(async (req, res) => {
  const { day } = req.params;
  const dayNum = parseInt(day, 10);
  if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 365) {
    throw httpError('Le jour doit etre compris entre 1 et 365', 400);
  }

  const Model = req.getModel('ReadingPlan', ReadingPlanSchema);
  const plan = await Model.findOne({ isPublished: true, 'days.day': dayNum });
  if (!plan) throw httpError('Aucun plan de lecture trouve pour ce jour', 404);

  const dayEntry = plan.days.find((d) => d.day === dayNum);
  if (!dayEntry) throw httpError('Jour introuvable dans ce plan', 404);

  return sendResponse(res, { plan, day: dayEntry }, 'Jour recupere');
});
