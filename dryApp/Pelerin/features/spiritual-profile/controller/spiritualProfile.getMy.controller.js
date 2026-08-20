const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SpiritualProfileSchema = require('../model/spiritualProfile.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('SpiritualProfile', SpiritualProfileSchema);
  const profile = await Model.findOne({ createdBy: req.user.id });
  if (!profile) {
    return sendResponse(res, null, 'Profil spirituel introuvable', false, undefined, 404);
  }
  return sendResponse(res, profile, 'Profil spirituel recupere');
});
