const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const HabitSchema = require('../model/habit.schema');
const HabitLogSchema = require('../../habitLog/model/habitLog.schema');

const toISODate = (date) => date.toISOString().slice(0, 10);

// Calcule le streak courant (nombre de jours consecutifs valides jusqu'a
// aujourd'hui inclus) a partir des dates loguees, en jours calendaires.
function computeStreak(loggedDates) {
  const set = new Set(loggedDates);
  let streak = 0;
  const cursor = new Date();
  while (set.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

module.exports = asyncHandler(async (req, res) => {
  const HabitModel = req.getModel('Habit', HabitSchema);
  const LogModel = req.getModel('HabitLog', HabitLogSchema);

  const habits = await HabitModel.find({ createdBy: req.user.id }).sort({ createdAt: 1 });
  const logs = await LogModel.find(
    { createdBy: req.user.id, habitId: { $in: habits.map((h) => h._id) } },
    'habitId date',
  );

  const logsByHabit = new Map();
  for (const log of logs) {
    const key = String(log.habitId);
    if (!logsByHabit.has(key)) logsByHabit.set(key, []);
    logsByHabit.get(key).push(log.date);
  }

  const today = toISODate(new Date());
  const data = habits.map((habit) => {
    const dates = logsByHabit.get(String(habit._id)) || [];
    return {
      ...habit.toObject(),
      streak: computeStreak(dates),
      doneToday: dates.includes(today),
      totalCompletions: dates.length,
    };
  });

  return sendResponse(res, data, 'Habitudes recuperees');
});
