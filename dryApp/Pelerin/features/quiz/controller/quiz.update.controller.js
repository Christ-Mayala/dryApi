const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const QuizSchema = require('../model/quiz.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Quiz', QuizSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true },
  );
  if (!item) throw httpError('Question introuvable', 404);
  return sendResponse(res, item, 'Question mise a jour');
});
