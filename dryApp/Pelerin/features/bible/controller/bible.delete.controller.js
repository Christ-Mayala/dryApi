const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BibleVerseSchema = require('../model/bible.schema');

// DELETE - soft delete (status: 'deleted'), jamais de suppression physique
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const item = await Model.findByIdAndUpdate(
    req.params.id,
    { status: 'deleted', updatedBy: req.user?.id },
    { new: true },
  );
  if (!item) throw new Error('Verset introuvable');
  return sendResponse(res, null, 'Verset supprime');
});
