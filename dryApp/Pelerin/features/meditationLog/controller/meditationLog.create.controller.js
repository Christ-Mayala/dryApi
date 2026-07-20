const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const MeditationLogSchema = require('../model/meditationLog.schema');

module.exports = asyncHandler(async (req, res) => {
  const { meditationId, feeling, thoughts, date } = req.body;
  if (!meditationId) throw httpError('meditationId est requis', 400);

  const Model = req.getModel('MeditationLog', MeditationLogSchema);
  const item = await Model.create({
    meditationId,
    feeling,
    thoughts,
    date: date || Date.now(),
    createdBy: req.user.id,
  });

  return sendResponse(res, item, 'Ressenti enregistre');
});
