const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const QuizSchema = require('../model/quiz.schema');

// GET /quiz/admin/:id — admin uniquement, expose correctAnswerIndex/explanation
// (masques sur la route publique GET /:id) pour permettre l'edition en CMS.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Quiz', QuizSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw httpError('Question introuvable', 404);
  return sendResponse(res, item, 'Question recuperee');
});
