const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const NotificationSchema = require('../model/notification.schema');

// Marque TOUTES les notifications de l'utilisateur comme lues.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notification', NotificationSchema);
  const result = await Model.updateMany(
    { createdBy: req.user.id, read: false },
    { read: true, readAt: new Date() },
  );

  return sendResponse(res, { modified: result.modifiedCount ?? 0 }, 'Toutes les notifications sont lues');
});
