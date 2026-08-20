const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const NotificationSchema = require('../model/notification.schema');

// Liste des notifications de l'utilisateur connecté, plus récentes d'abord.
// ?limit= (défaut 50) et ?unreadOnly=true pour ne garder que les non-lues.
module.exports = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const unreadOnly = String(req.query.unreadOnly) === 'true';

  const Model = req.getModel('Notification', NotificationSchema);
  const filter = { createdBy: req.user.id, ...(unreadOnly ? { read: false } : {}) };

  const [items, unreadCount] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Model.countDocuments({ createdBy: req.user.id, read: false }),
  ]);

  return sendResponse(res, { items, unreadCount }, 'Notifications récupérées');
});
