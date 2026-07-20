const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const QuizSchema = require('../model/quiz.schema');

// GET /quiz — public, mais sans la reponse ni l'explication (evite de trivialiser
// le quiz en lisant directement l'API). ?theme= et ?difficulty= pour filtrer.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Quiz', QuizSchema);
  const filter = {};
  if (req.query.theme) filter.theme = req.query.theme;
  if (req.query.difficulty) filter.difficulty = req.query.difficulty;

  const items = await Model.find(filter, '-correctAnswerIndex -explanation').sort({
    createdAt: -1,
  });
  return sendResponse(res, items, 'Questions recuperees');
});
