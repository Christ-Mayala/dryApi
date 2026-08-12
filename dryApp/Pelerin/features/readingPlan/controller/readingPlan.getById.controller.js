const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReadingPlanSchema = require('../model/readingPlan.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ReadingPlan', ReadingPlanSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Plan de lecture introuvable');
  return sendResponse(res, item, 'Plan recupere');
});
