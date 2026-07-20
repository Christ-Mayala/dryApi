const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BibleVerseSchema = require('../model/bible.schema');

// GET BY ID - recupere un verset par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Verset introuvable');
  return sendResponse(res, item, 'Verset recupere');
});
