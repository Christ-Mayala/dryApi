const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const UserJourneySchema = require('../model/userJourney.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('UserJourney', UserJourneySchema);
  const journey = await Model.findOne({ createdBy: req.user.id });
  if (!journey) {
    return sendResponse(res, null, 'Aucune progression enregistree', false, undefined, 404);
  }
  return sendResponse(res, journey, 'Progression recuperee');
});
