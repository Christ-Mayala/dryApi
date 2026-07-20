const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const MeditationLogSchema = require('../model/meditationLog.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('MeditationLog', MeditationLogSchema);
  const item = await Model.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!item) throw httpError('Entree introuvable', 404);
  await item.deleteOne();
  return sendResponse(res, null, 'Entree supprimee');
});
