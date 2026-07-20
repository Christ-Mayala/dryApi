const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ParcoursProgressSchema = require('../model/parcoursProgress.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ParcoursProgress', ParcoursProgressSchema);
  const items = await Model.find({ createdBy: req.user.id })
    .populate('parcoursId')
    .sort({ updatedAt: -1 });
  return sendResponse(res, items, 'Progressions recuperees');
});
