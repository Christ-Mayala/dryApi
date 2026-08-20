const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { NotificationPreferencesSchema } = require('../model/notifications.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('NotificationPreferences', NotificationPreferencesSchema);
  const payload = { ...req.body, createdBy: req.user.id };

  const prefs = await Model.findOneAndUpdate(
    { createdBy: req.user.id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true },
  );

  return sendResponse(res, prefs, 'Preferences mises a jour');
});
