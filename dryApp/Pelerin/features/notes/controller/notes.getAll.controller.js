const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const NotesSchema = require('../model/notes.schema');

// GET /notes — mes notes uniquement. Par defaut : contenu du dossier racine
// (?parentId absent -> parentId: null). ?parentId=<id> pour un sous-dossier,
// ?parentId=all pour tout recuperer a plat (utile pour la recherche cote client).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notes', NotesSchema);
  const filter = { createdBy: req.user.id };

  if (req.query.parentId === 'all') {
    // pas de filtre parentId
  } else if (req.query.parentId) {
    filter.parentId = req.query.parentId;
  } else {
    filter.parentId = null;
  }

  const items = await Model.find(filter).sort({ type: 1, updatedAt: -1 });
  return sendResponse(res, items, 'Notes recuperees');
});
