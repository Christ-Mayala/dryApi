const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HabitSchema = require('../model/habit.schema');

module.exports = asyncHandler(async (req, res) => {
  const { title, icon, frequency, reminderTime } = req.body;
  if (!title) throw httpError('title est requis', 400);

  const Model = req.getModel('Habit', HabitSchema);
  const item = await Model.create({
    title,
    icon,
    frequency,
    reminderTime,
    createdBy: req.user.id,
  });

  return sendResponse(res, item, 'Habitude creee');
});
