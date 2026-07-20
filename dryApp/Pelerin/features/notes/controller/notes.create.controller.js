const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotesSchema = require('../model/notes.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notes', NotesSchema);
  const { title, type, content, parentId, links, color, tags } = req.body;

  if (!title) throw httpError('title est requis', 400);

  if (parentId) {
    const parent = await Model.findOne({ _id: parentId, createdBy: req.user.id });
    if (!parent) throw httpError('Dossier parent introuvable', 400);
  }

  const item = await Model.create({
    title,
    type: type === 'folder' ? 'folder' : 'document',
    content: content || '',
    parentId: parentId || null,
    links: links || [],
    color,
    tags: Array.isArray(tags) ? tags : [],
    createdBy: req.user.id,
  });

  return sendResponse(res, item, 'Note creee');
});
