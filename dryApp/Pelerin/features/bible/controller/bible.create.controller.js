const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BibleVerseSchema = require('../model/bible.schema');

// CREATE - ajoute/corrige un verset (usage admin ; le seed en masse passe par seed.js)
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.createdBy = req.user.id;
  const item = await Model.create(payload);
  return sendResponse(res, item, 'Verset cree');
});
