const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleVerseSchema = require('../model/bible.schema');

// GET /bible/chapter?version=LSG1910&bookCode=jean&chapter=3
// Cas d'usage principal de lecture : tous les versets d'un chapitre, dans l'ordre.
module.exports = asyncHandler(async (req, res) => {
  const { version, bookCode, chapter } = req.query;

  if (!version || !bookCode || !chapter) {
    throw httpError('version, bookCode et chapter sont requis', 400);
  }
  if (!BibleVerseSchema.statics.VERSIONS.includes(version)) {
    throw httpError('Version biblique inconnue', 400);
  }

  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const verses = await Model.find({
    version,
    bookCode: String(bookCode).toLowerCase(),
    chapter: Number(chapter),
  }).sort({ verse: 1 });

  if (verses.length === 0) {
    throw httpError('Chapitre introuvable pour cette version', 404);
  }

  return sendResponse(res, verses, 'Chapitre recupere');
});
