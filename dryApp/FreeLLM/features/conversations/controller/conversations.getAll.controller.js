const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ConversationsSchema = require('../model/conversations.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Conversations', ConversationsSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null }).sort({ updatedAt: -1 });
  return sendResponse(res, items, 'Conversations liste');
});
