const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const UserJourneySchema = require('../model/userJourney.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('UserJourney', UserJourneySchema);
  const payload = { ...req.body, createdBy: req.user.id };

  const item = await Model.findOneAndUpdate(
    { createdBy: req.user.id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true },
  );

  return sendResponse(res, item, 'Progression mise a jour');
});
