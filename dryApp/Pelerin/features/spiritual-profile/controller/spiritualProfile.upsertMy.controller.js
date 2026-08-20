const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SpiritualProfileSchema = require('../model/spiritualProfile.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('SpiritualProfile', SpiritualProfileSchema);
  const payload = { ...req.body, createdBy: req.user.id };

  const profile = await Model.findOneAndUpdate(
    { createdBy: req.user.id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true },
  );

  return sendResponse(res, profile, 'Profil spirituel mis a jour');
});
