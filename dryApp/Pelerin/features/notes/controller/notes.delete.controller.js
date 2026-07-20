const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotesSchema = require('../model/notes.schema');

// Suppression recursive : un dossier supprime ses enfants directs (une seule
// profondeur suffit pour l'usage courant ; on boucle pour couvrir les sous-dossiers).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notes', NotesSchema);
  const item = await Model.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!item) throw httpError('Note introuvable', 404);

  const idsToDelete = [item._id];
  let frontier = [item._id];
  while (frontier.length > 0) {
    const children = await Model.find({ createdBy: req.user.id, parentId: { $in: frontier } }, '_id');
    if (children.length === 0) break;
    frontier = children.map((c) => c._id);
    idsToDelete.push(...frontier);
  }

  await Model.updateMany(
    { _id: { $in: idsToDelete } },
    { $set: { status: 'deleted', updatedBy: req.user.id } },
  );

  return sendResponse(res, null, 'Note supprimee');
});
