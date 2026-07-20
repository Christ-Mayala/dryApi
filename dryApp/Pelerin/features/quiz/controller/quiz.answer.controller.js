const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const QuizSchema = require('../model/quiz.schema');
const QuizAttemptSchema = require('../../quizAttempt/model/quizAttempt.schema');

// POST /quiz/:id/answer  { selectedIndex }
// Valide la reponse cote serveur (jamais fait confiance au client), enregistre
// la tentative, et renvoie la correction + l'explication.
module.exports = asyncHandler(async (req, res) => {
  const { selectedIndex } = req.body;
  if (selectedIndex === undefined || selectedIndex === null) {
    throw httpError('selectedIndex est requis', 400);
  }

  const QuizModel = req.getModel('Quiz', QuizSchema);
  const question = await QuizModel.findById(req.params.id);
  if (!question) throw httpError('Question introuvable', 404);

  const isCorrect = Number(selectedIndex) === question.correctAnswerIndex;

  const AttemptModel = req.getModel('QuizAttempt', QuizAttemptSchema);
  await AttemptModel.create({
    questionId: question._id,
    selectedIndex,
    isCorrect,
    createdBy: req.user.id,
  });

  return sendResponse(res, {
    isCorrect,
    correctAnswerIndex: question.correctAnswerIndex,
    explanation: question.explanation,
  }, isCorrect ? 'Bonne reponse !' : 'Reponse incorrecte');
});
