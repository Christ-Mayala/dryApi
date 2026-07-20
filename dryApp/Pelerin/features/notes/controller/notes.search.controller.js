const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotesSchema = require('../model/notes.schema');

module.exports = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    throw httpError('Le parametre de recherche "q" doit contenir au moins 2 caracteres', 400);
  }

  const Model = req.getModel('Notes', NotesSchema);
  const items = await Model.find(
    { createdBy: req.user.id, $text: { $search: q } },
    { score: { $meta: 'textScore' } },
  ).sort({ score: { $meta: 'textScore' } });

  return sendResponse(res, items, 'Resultats de recherche');
});
