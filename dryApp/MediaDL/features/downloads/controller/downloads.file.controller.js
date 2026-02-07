const asyncHandler = require('express-async-handler');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const DownloadsSchema = require('../model/downloads.schema');
const { scheduleCleanup } = require('../../../../../dry/services/media/downloadJobs');

const getTtlMs = () => {
  const raw = Number(process.env.MEDIA_FILE_TTL_MINUTES || process.env.MEDIA_TTL_MINUTES || 5);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 5;
  return minutes * 60 * 1000;
};

module.exports = asyncHandler(async (req, res) => {
  const Download = req.getModel('Downloads', DownloadsSchema);
  const item = await Download.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Downloads introuvable', data: null });

  if (req.user && req.user.role !== 'admin') {
    if (String(item.requestedBy) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Non autorise', data: null });
    }
  }

  if (item.jobStatus !== 'done') {
    return res.status(409).json({ success: false, message: 'Fichier indisponible', data: null });
  }

  if (!item.path || !fs.existsSync(item.path)) {
    return res.status(410).json({ success: false, message: 'Fichier supprime', data: null });
  }

  const ttlMs = getTtlMs();
  const expiresAt = new Date(Date.now() + ttlMs);
  await Download.findByIdAndUpdate(item._id, { expiresAt });

  scheduleCleanup(
    item._id,
    async () => {
      if (item.path && fs.existsSync(item.path)) {
        try { await fsp.unlink(item.path); } catch {}
      }
      await Download.findByIdAndUpdate(item._id, { path: null, sizeBytes: null, expiresAt: null });
    },
    ttlMs
  );

  const downloadName = path.basename(item.path);
  return res.download(item.path, downloadName);
});
