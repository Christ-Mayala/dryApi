const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleAnnotationSchema = require('../model/bibleAnnotation.schema');

// GET /bibleannotation/verse?version=&bookCode=&chapter=&verse=
// Renvoie l'annotation de l'utilisateur courant pour CE verset precis, ou null.
module.exports = asyncHandler(async (req, res) => {
  const { version, bookCode, chapter, verse } = req.query;
  if (!version || !bookCode || !chapter || !verse) {
    throw httpError('version, bookCode, chapter et verse sont requis', 400);
  }

  const Model = req.getModel('BibleAnnotation', BibleAnnotationSchema);
  const item = await Model.findOne({
    createdBy: req.user.id,
    version,
    bookCode: String(bookCode).toLowerCase(),
    chapter: Number(chapter),
    verse: Number(verse),
  });

  return sendResponse(res, item, item ? 'Annotation trouvee' : 'Aucune annotation');
});
