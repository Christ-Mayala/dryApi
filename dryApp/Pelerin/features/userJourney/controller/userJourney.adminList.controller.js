const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const UserJourneySchema = require('../model/userJourney.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('UserJourney', UserJourneySchema);
  const items = await Model.find().sort({ points: -1 }).limit(100);
  return sendResponse(res, items, 'Liste recuperee');
});
