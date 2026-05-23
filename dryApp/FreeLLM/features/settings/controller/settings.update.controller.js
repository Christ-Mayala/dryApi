const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SettingsSchema = require('../model/settings.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Settings', SettingsSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user?.id },
    { new: true }
  );
  if (!item) {
    res.status(404);
    throw new Error('Settings non trouve');
  }
  return sendResponse(res, item, 'Settings mis a jour');
});
