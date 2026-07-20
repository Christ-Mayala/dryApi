const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotesSchema = require('../model/notes.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notes', NotesSchema);
  const { title, content, parentId, links, color, tags, isFavorite, lastAccessedAt, clientUpdatedAt } = req.body;

  if (parentId) {
    if (String(parentId) === String(req.params.id)) {
      throw httpError('Une note ne peut pas etre son propre dossier parent', 400);
    }
    const parent = await Model.findOne({ _id: parentId, createdBy: req.user.id });
    if (!parent) throw httpError('Dossier parent introuvable', 400);
  }

  const current = await Model.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!current) throw httpError('Note introuvable', 404);

  // Resolution de conflit last-write-wins (File_Sync hors ligne) : si la mutation du
  // client est basee sur un etat plus ancien que celui deja present cote serveur (ecrit
  // entretemps par un autre appareil), on rejette et on renvoie la version serveur pour
  // que le client l'adopte plutot que d'ecraser un contenu plus recent.
  if (clientUpdatedAt && new Date(clientUpdatedAt).getTime() < current.updatedAt.getTime()) {
    return sendResponse(res, current, 'Conflit de version : la note a ete modifiee ailleurs entretemps', false, undefined, 409);
  }

  const update = { updatedBy: req.user.id };
  if (title !== undefined) update.title = title;
  if (content !== undefined) update.content = content;
  if (parentId !== undefined) update.parentId = parentId || null;
  if (links !== undefined) update.links = links;
  if (color !== undefined) update.color = color;
  if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : [];
  if (isFavorite !== undefined) update.isFavorite = Boolean(isFavorite);
  if (lastAccessedAt !== undefined) update.lastAccessedAt = lastAccessedAt;

  const item = await Model.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set: update },
    { new: true, runValidators: true },
  );
  return sendResponse(res, item, 'Note mise a jour');
});
