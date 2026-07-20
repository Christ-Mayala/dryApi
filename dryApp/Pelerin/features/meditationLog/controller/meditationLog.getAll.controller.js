const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const MeditationLogSchema = require('../model/meditationLog.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('MeditationLog', MeditationLogSchema);
  const items = await Model.find({ createdBy: req.user.id })
    .populate('meditationId')
    .sort({ date: -1 });
  return sendResponse(res, items, 'Historique recupere');
});
