const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const QuizSchema = require('../model/quiz.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Quiz', QuizSchema);
  const item = await Model.create({ ...req.body, createdBy: req.user.id });
  return sendResponse(res, item, 'Question creee');
});
