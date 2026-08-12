const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReadingPlanSchema = require('../model/readingPlan.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ReadingPlan', ReadingPlanSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new Error('Plan de lecture introuvable');
  return sendResponse(res, item, 'Plan mis a jour');
});
