const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BibleVerseSchema = require('../model/bible.schema');

// UPDATE - corrige un verset existant
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new Error('Verset introuvable');
  return sendResponse(res, item, 'Verset mis a jour');
});
