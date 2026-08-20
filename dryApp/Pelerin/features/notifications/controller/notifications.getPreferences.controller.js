const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { NotificationPreferencesSchema } = require('../model/notifications.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('NotificationPreferences', NotificationPreferencesSchema);
  const prefs = await Model.findOne({ createdBy: req.user.id });
  return sendResponse(res, prefs, 'Preferences recuperees');
});
