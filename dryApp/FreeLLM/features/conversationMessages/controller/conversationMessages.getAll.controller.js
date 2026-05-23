const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationMessagesSchema = require('../model/conversationMessages.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ConversationMessages', ConversationMessagesSchema);
  const filter = { ...req.queryBuilder?.filter, deletedAt: null };
  if (req.query.conversationId) {
    filter.conversationId = req.query.conversationId;
  }
  const items = await Model.find(filter).sort({ createdAt: 1 });
  return sendResponse(res, items, 'ConversationMessages liste');
});
