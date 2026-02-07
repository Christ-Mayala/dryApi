const asyncHandler = require('express-async-handler');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sendResponse = require('../../../../../dry/utils/http/response');
const DownloadsSchema = require('../model/downloads.schema');
const PresetsSchema = require('../../presets/model/presets.schema');
const MultiPlatformDownloader = require('../../../../../dry/services/media/multiPlatformDownloader');
const { registerJob, scheduleCleanup } = require('../../../../../dry/services/media/downloadJobs');

const detectPlatform = (url) => {
  if (/youtu(\.be|be\.com)/.test(url)) return 'youtube';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
  if (url.includes('tiktok.com')) return 'tiktok';
  return 'unknown';
};

const getTtlMs = () => {
  const raw = Number(process.env.MEDIA_FILE_TTL_MINUTES || process.env.MEDIA_TTL_MINUTES || 5);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 5;
  return minutes * 60 * 1000;
};

const cleanupFile = async (Download, docId, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try { await fsp.unlink(filePath); } catch {}
  }
  await Download.findByIdAndUpdate(docId, { path: null, sizeBytes: null, expiresAt: null });
};

module.exports = asyncHandler(async (req, res) => {
  const { url, mediaType = 'video', filename, qualityMode = 'smooth', maxHeight, presetId, batchId, label } = req.body;
  const platform = detectPlatform(url || '');

  if (platform === 'unknown') {
    return sendResponse(res, null, 'Plateforme non supportee', false);
  }
  if (mediaType === 'audio' && platform !== 'youtube') {
    return sendResponse(res, null, 'Audio supporte uniquement pour YouTube', false);
  }

  const requestedBy = req.user?.id;
  if (!requestedBy) {
    return sendResponse(res, null, 'Non autorise', false);
  }

  const Download = req.getModel('Downloads', DownloadsSchema);
  const Preset = req.getModel('Presets', PresetsSchema);

  let preset = null;
  if (presetId) preset = await Preset.findById(presetId);
  const requestedMaxHeight = mediaType === 'video' ? (Number(maxHeight) || preset?.maxHeight || null) : null;

  const doc = await Download.create({
    url,
    platform,
    mediaType,
    filename,
    maxHeight: requestedMaxHeight || undefined,
    jobStatus: 'pending',
    progress: 0,
    requestedBy,
    presetId: preset?._id,
    batchId: batchId || null,
    label: label || filename || platform
  });

  (async () => {
    const abortController = new AbortController();
    registerJob(doc._id, { abort: () => abortController.abort() });

    let lastProgress = 0;
    let lastProgressTs = 0;
    let fakeProgress = 0;
    let fakeTimer = null;
    const stopFake = () => {
      if (fakeTimer) {
        clearInterval(fakeTimer);
        fakeTimer = null;
      }
    };
    fakeTimer = setInterval(async () => {
      if (lastProgressTs > 0) return;
      if (fakeProgress >= 95) return;
      fakeProgress = Math.min(95, fakeProgress + Math.floor(Math.random() * 6) + 3);
      await Download.findByIdAndUpdate(doc._id, { progress: fakeProgress });
    }, 1500);
    const reportProgress = async (value) => {
      if (value === null || value === undefined) return;
      const progress = Math.max(0, Math.min(100, Math.floor(Number(value))));
      const now = Date.now();
      if (progress === lastProgress) return;
      if (progress < 100 && now - lastProgressTs < 800) return;
      lastProgress = progress;
      lastProgressTs = now;
      stopFake();
      await Download.findByIdAndUpdate(doc._id, { progress });
    };

    let targetPath = null;
    const onTarget = async (filePath) => {
      if (!filePath || targetPath) return;
      targetPath = filePath;
      await Download.findByIdAndUpdate(doc._id, { path: filePath });
    };

    const startedAt = new Date();
    const startTs = Date.now();
    await Download.findByIdAndUpdate(doc._id, { jobStatus: 'running', startedAt, progress: 0 });

    const runner = new MultiPlatformDownloader({
      downloadDir: preset?.downloadDir || process.env.MEDIA_DIR || 'downloads',
      qualityMode: mediaType === 'audio' ? 'audio' : (preset?.qualityMode || qualityMode),
      maxHeight: requestedMaxHeight || undefined,
      verbose: process.env.MEDIA_VERBOSE === 'true',
      signal: abortController.signal,
      onProgress: reportProgress,
      onTarget
    });

    let result = null;
    try {
      result = await runner.downloadMedia(url, filename, mediaType);
    } catch (err) {
      stopFake();
      if (abortController.signal.aborted) {
        await Download.findByIdAndUpdate(doc._id, {
          jobStatus: 'cancelled',
          error: 'Annule par utilisateur',
          finishedAt: new Date()
        });
        return;
      }
      await Download.findByIdAndUpdate(doc._id, {
        jobStatus: 'error',
        error: err.message,
        finishedAt: new Date()
      });
      return;
    }

    if (!result.success) {
      stopFake();
      const isCancelled = abortController.signal.aborted;
      await Download.findByIdAndUpdate(doc._id, {
        jobStatus: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? 'Annule par utilisateur' : result.message,
        finishedAt: new Date()
      });
      return;
    }

    stopFake();
    const durationMs = Date.now() - startTs;
    const finishedAt = new Date();
    const ttlMs = getTtlMs();
    const expiresAt = new Date(Date.now() + ttlMs);
    const finalPath = result.path || targetPath;
    const finalName = filename || (finalPath ? path.basename(finalPath) : undefined);
    await Download.findByIdAndUpdate(doc._id, {
      jobStatus: 'done',
      path: finalPath,
      sizeBytes: result.size || null,
      filename: finalName,
      durationMs,
      finishedAt,
      progress: 100,
      expiresAt
    });

    scheduleCleanup(
      doc._id,
      async () => {
        const filePath = finalPath;
        await cleanupFile(Download, doc._id, filePath);
      },
      ttlMs
    );
  })().catch(async (err) => {
    await Download.findByIdAndUpdate(doc._id, {
      jobStatus: 'error',
      error: err.message,
      finishedAt: new Date()
    });
  });

  return sendResponse(res, { id: doc._id, status: 'pending' }, 'Telechargement lance', true);
});
