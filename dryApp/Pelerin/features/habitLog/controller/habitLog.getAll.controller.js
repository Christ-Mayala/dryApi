const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HabitLogSchema = require('../model/habitLog.schema');

// GET /habitlog?habitId=&from=&to=  — historique de coches pour une habitude.
module.exports = asyncHandler(async (req, res) => {
  const { habitId } = req.query;
  if (!habitId) throw httpError('habitId est requis', 400);

  const Model = req.getModel('HabitLog', HabitLogSchema);
  const filter = { createdBy: req.user.id, habitId };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  const items = await Model.find(filter).sort({ date: -1 });
  return sendResponse(res, items, 'Historique recupere');
});
