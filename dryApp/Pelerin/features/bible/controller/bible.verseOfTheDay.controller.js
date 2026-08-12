const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleVerseSchema = require('../../bible/model/bible.schema');

module.exports = asyncHandler(async (req, res) => {
  const { version } = req.query;
  const allowed = BibleVerseSchema.statics.VERSIONS;
  const v = version && allowed.includes(version) ? version : 'LSG1910';

  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const count = await Model.countDocuments({ version: v });
  if (count === 0) throw httpError('Aucun verset disponible pour cette version', 404);

  const randomIndex = Math.floor(Math.random() * count);
  const verse = await Model.findOne({ version: v }).skip(randomIndex);

  if (!verse) throw httpError('Verset introuvable', 404);

  return sendResponse(res, verse, 'Verset du jour');
});
