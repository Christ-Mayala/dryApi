const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HabitSchema = require('../../habit/model/habit.schema');
const HabitLogSchema = require('../model/habitLog.schema');

// POST /habitlog/toggle  { habitId, date }
// Coche/decoche une habitude pour un jour donne (idempotent, pas d'etat cote client a suivre).
module.exports = asyncHandler(async (req, res) => {
  const { habitId, date } = req.body;
  if (!habitId || !date) throw httpError('habitId et date sont requis', 400);

  const HabitModel = req.getModel('Habit', HabitSchema);
  const habit = await HabitModel.findOne({ _id: habitId, createdBy: req.user.id });
  if (!habit) throw httpError('Habitude introuvable', 404);

  const LogModel = req.getModel('HabitLog', HabitLogSchema);
  const existing = await LogModel.findOne({ createdBy: req.user.id, habitId, date });

  if (existing) {
    await existing.deleteOne();
    return sendResponse(res, { done: false }, 'Jour decoche');
  }

  await LogModel.create({ habitId, date, createdBy: req.user.id });
  return sendResponse(res, { done: true }, 'Jour coche');
});
