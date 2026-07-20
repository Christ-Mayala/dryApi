const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleAnnotationSchema = require('../model/bibleAnnotation.schema');

// POST /bibleannotation — cree ou met a jour l'annotation de l'utilisateur courant
// pour un verset donne (favori / surlignage / note personnelle).
module.exports = asyncHandler(async (req, res) => {
  const { version, bookCode, chapter, verse, text, isFavorite, highlightColor, note, clientUpdatedAt } = req.body;

  if (!version || !bookCode || !chapter || !verse) {
    throw httpError('version, bookCode, chapter et verse sont requis', 400);
  }

  const Model = req.getModel('BibleAnnotation', BibleAnnotationSchema);

  const query = {
    createdBy: req.user.id,
    version,
    bookCode: String(bookCode).toLowerCase(),
    chapter: Number(chapter),
    verse: Number(verse),
  };

  // Resolution de conflit last-write-wins (File_Sync hors ligne) : voir
  // notes.update.controller.js pour le raisonnement complet.
  const existing = await Model.findOne(query);
  if (existing && clientUpdatedAt && new Date(clientUpdatedAt).getTime() < existing.updatedAt.getTime()) {
    return sendResponse(res, existing, "Conflit de version : l'annotation a ete modifiee ailleurs entretemps", false, undefined, 409);
  }

  const update = { updatedBy: req.user.id };
  if (text !== undefined) update.text = text;
  if (isFavorite !== undefined) update.isFavorite = isFavorite;
  if (highlightColor !== undefined) update.highlightColor = highlightColor;
  if (note !== undefined) update.note = note;

  const item = await Model.findOneAndUpdate(
    query,
    { $set: update, $setOnInsert: { createdBy: req.user.id } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );

  return sendResponse(res, item, 'Annotation enregistree');
});
