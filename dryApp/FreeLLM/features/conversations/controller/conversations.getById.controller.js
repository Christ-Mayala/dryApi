const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationsSchema = require('../model/conversations.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Conversations', ConversationsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Conversations non trouve');
  }
  return sendResponse(res, item, 'Conversations recupere');
});
