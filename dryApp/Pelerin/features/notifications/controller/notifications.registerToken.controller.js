const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { PushTokenSchema } = require('../model/notifications.schema');

module.exports = asyncHandler(async (req, res) => {
  const { pushToken, platform } = req.body;
  if (!pushToken || !platform) {
    return sendResponse(res, null, 'pushToken et platform requis', false, undefined, 400);
  }

  const Model = req.getModel('PushToken', PushTokenSchema);

  const existing = await Model.findOne({ createdBy: req.user.id, pushToken });
  if (existing) {
    return sendResponse(res, existing, 'Token deja enregistre');
  }

  const token = await Model.create({
    createdBy: req.user.id,
    pushToken,
    platform,
  });

  return sendResponse(res, token, 'Token enregistre');
});
