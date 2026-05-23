const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationMessagesSchema = require('../model/conversationMessages.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ConversationMessages', ConversationMessagesSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'ConversationMessages cree');
});
