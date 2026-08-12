const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReadingPlanSchema = require('../model/readingPlan.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ReadingPlan', ReadingPlanSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { status: 'deleted', updatedBy: req.user?.id },
    { new: true },
  );
  if (!item) throw new Error('Plan de lecture introuvable');
  return sendResponse(res, null, 'Plan supprime');
});
