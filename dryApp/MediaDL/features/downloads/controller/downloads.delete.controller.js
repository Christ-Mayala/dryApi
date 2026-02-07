const asyncHandler = require('express-async-handler');
const fs = require('fs');
const fsp = require('fs/promises');
const sendResponse = require('../../../../../dry/utils/http/response');
const DownloadsSchema = require('../model/downloads.schema');
const { getJob, clearJob } = require('../../../../../dry/services/media/downloadJobs');

module.exports = asyncHandler(async (req, res) => {
  const Download = req.getModel('Downloads', DownloadsSchema);
  const item = await Download.findById(req.params.id);
  if (!item) return sendResponse(res, null, 'Downloads introuvable', false);

  if (req.user && req.user.role !== 'admin') {
    if (String(item.requestedBy) !== String(req.user.id)) {
      return sendResponse(res, null, 'Non autorise', false);
    }
  }

  if (['pending', 'running'].includes(item.jobStatus)) {
    const job = getJob(item._id);
    if (job && typeof job.abort === 'function') {
      job.abort();
    }
  }
  clearJob(item._id);

  if (item.path && fs.existsSync(item.path)) {
    try { await fsp.unlink(item.path); } catch {}
  }

  await Download.findByIdAndDelete(item._id);
  return sendResponse(res, { id: item._id }, 'Downloads supprime', true);
});
