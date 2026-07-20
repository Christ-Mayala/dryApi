const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HabitSchema = require('../model/habit.schema');

module.exports = asyncHandler(async (req, res) => {
  const { title, icon, frequency, reminderTime, isActive } = req.body;
  const update = { updatedBy: req.user.id };
  if (title !== undefined) update.title = title;
  if (icon !== undefined) update.icon = icon;
  if (frequency !== undefined) update.frequency = frequency;
  if (reminderTime !== undefined) update.reminderTime = reminderTime;
  if (isActive !== undefined) update.isActive = isActive;

  const Model = req.getModel('Habit', HabitSchema);
  const item = await Model.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set: update },
    { new: true, runValidators: true },
  );
  if (!item) throw httpError('Habitude introuvable', 404);
  return sendResponse(res, item, 'Habitude mise a jour');
});
