const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const DownloadsSchema = require('../model/downloads.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Downloads', DownloadsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) return sendResponse(res, null, 'Downloads introuvable', false);

  if (req.user && req.user.role !== 'admin') {
    if (String(item.requestedBy) !== String(req.user.id)) {
      return sendResponse(res, null, 'Non autorise', false);
    }
  }

  return sendResponse(res, item, 'Downloads recupere');
});
