const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const NotesSchema = require('../model/notes.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Notes', NotesSchema);
  const item = await Model.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!item) throw httpError('Note introuvable', 404);
  return sendResponse(res, item, 'Note recuperee');
});
