const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HabitSchema = require('../model/habit.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Habit', HabitSchema);
  const item = await Model.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { status: 'deleted', updatedBy: req.user.id },
    { new: true },
  );
  if (!item) throw httpError('Habitude introuvable', 404);
  return sendResponse(res, null, 'Habitude supprimee');
});
