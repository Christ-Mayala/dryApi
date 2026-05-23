const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationsSchema = require('../model/conversations.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Conversations', ConversationsSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'Conversations cree');
});
