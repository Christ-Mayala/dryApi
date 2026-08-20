const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotificationSchema = require('../model/notification.schema');

// Marque UNE notification comme lue. Seul son propriétaire peut la modifier.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notification', NotificationSchema);
  const item = await Model.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { read: true, readAt: new Date() },
    { new: true },
  );
  if (!item) throw httpError('Notification introuvable', 404);

  return sendResponse(res, item, 'Notification marquée comme lue');
});
