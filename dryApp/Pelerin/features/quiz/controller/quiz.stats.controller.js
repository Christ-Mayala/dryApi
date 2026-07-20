const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const QuizAttemptSchema = require('../../quizAttempt/model/quizAttempt.schema');

// GET /quiz/stats — mes statistiques personnelles.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('QuizAttempt', QuizAttemptSchema);
  const attempts = await Model.find({ createdBy: req.user.id }, 'isCorrect createdAt');

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;

  return sendResponse(res, {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
  }, 'Statistiques recuperees');
});
