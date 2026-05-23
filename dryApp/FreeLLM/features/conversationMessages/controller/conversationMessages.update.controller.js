const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationMessagesSchema = require('../model/conversationMessages.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('ConversationMessages', ConversationMessagesSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user?.id },
    { new: true }
  );
  if (!item) {
    res.status(404);
    throw new Error('ConversationMessages non trouve');
  }
  return sendResponse(res, item, 'ConversationMessages mis a jour');
});
