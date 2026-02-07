const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // downloads
  const downloadsSchema = require('./features/downloads/model/downloads.schema');
  const Downloads = getModel(appName, 'Downloads', downloadsSchema);
  const downloadsDocs = [
  {
    label: 'exemple_label_' + index,
    url: 'exemple_url_' + index,
    platform: 'exemple_platform_' + index,
    mediaType: 'exemple_mediaType_' + index,
    filename: 'exemple_filename_' + index,
    status: 'exemple_status_' + index,
    sizeBytes: 'exemple_sizeBytes_' + index,
    error: 'exemple_error_' + index,
    requestedBy: 'exemple_requestedBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finisheAt: 'exemple_finisheAt_' + index
  },
  {
    label: 'exemple_label_' + index,
    url: 'exemple_url_' + index,
    platform: 'exemple_platform_' + index,
    mediaType: 'exemple_mediaType_' + index,
    filename: 'exemple_filename_' + index,
    status: 'exemple_status_' + index,
    sizeBytes: 'exemple_sizeBytes_' + index,
    error: 'exemple_error_' + index,
    requestedBy: 'exemple_requestedBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finisheAt: 'exemple_finisheAt_' + index
  },
  {
    label: 'exemple_label_' + index,
    url: 'exemple_url_' + index,
    platform: 'exemple_platform_' + index,
    mediaType: 'exemple_mediaType_' + index,
    filename: 'exemple_filename_' + index,
    status: 'exemple_status_' + index,
    sizeBytes: 'exemple_sizeBytes_' + index,
    error: 'exemple_error_' + index,
    requestedBy: 'exemple_requestedBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finisheAt: 'exemple_finisheAt_' + index
  }
  ];
  const downloadsCreated = await Downloads.insertMany(downloadsDocs);
  count += downloadsCreated.length;
  await logSeed({
    appName,
    feature: 'downloads',
    modelName: 'Downloads',
    schemaPath: path.join(__dirname, 'features', 'downloads', 'model', 'downloads.schema.js'),
    ids: downloadsCreated.map((d) => d._id),
  });

  // batches
  const batchesSchema = require('./features/batches/model/batches.schema');
  const Batches = getModel(appName, 'Batches', batchesSchema);
  const batchesDocs = [
  {
    label: 'exemple_label_' + index,
    sourceType: 'exemple_sourceType_' + index,
    total: 'exemple_total_' + index,
    completed: 'exemple_completed_' + index,
    failed: 'exemple_failed_' + index,
    status: 'exemple_status_' + index,
    createdBy: 'exemple_createdBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finishedAt: 'exemple_finishedAt_' + index
  },
  {
    label: 'exemple_label_' + index,
    sourceType: 'exemple_sourceType_' + index,
    total: 'exemple_total_' + index,
    completed: 'exemple_completed_' + index,
    failed: 'exemple_failed_' + index,
    status: 'exemple_status_' + index,
    createdBy: 'exemple_createdBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finishedAt: 'exemple_finishedAt_' + index
  },
  {
    label: 'exemple_label_' + index,
    sourceType: 'exemple_sourceType_' + index,
    total: 'exemple_total_' + index,
    completed: 'exemple_completed_' + index,
    failed: 'exemple_failed_' + index,
    status: 'exemple_status_' + index,
    createdBy: 'exemple_createdBy_' + index,
    startedAt: 'exemple_startedAt_' + index,
    finishedAt: 'exemple_finishedAt_' + index
  }
  ];
  const batchesCreated = await Batches.insertMany(batchesDocs);
  count += batchesCreated.length;
  await logSeed({
    appName,
    feature: 'batches',
    modelName: 'Batches',
    schemaPath: path.join(__dirname, 'features', 'batches', 'model', 'batches.schema.js'),
    ids: batchesCreated.map((d) => d._id),
  });

  // presets
  const presetsSchema = require('./features/presets/model/presets.schema');
  const Presets = getModel(appName, 'Presets', presetsSchema);
  const presetsDocs = [
  {
    label: 'exemple_label_' + index,
    qualityMode: 'exemple_qualityMode_' + index,
    preferAudioOnly: 'exemple_preferAudioOnly_' + index,
    maxHeight: 'exemple_maxHeight_' + index,
    downloadDir: 'exemple_downloadDir_' + index,
    concurrent: 'exemple_concurrent_' + index
  },
  {
    label: 'exemple_label_' + index,
    qualityMode: 'exemple_qualityMode_' + index,
    preferAudioOnly: 'exemple_preferAudioOnly_' + index,
    maxHeight: 'exemple_maxHeight_' + index,
    downloadDir: 'exemple_downloadDir_' + index,
    concurrent: 'exemple_concurrent_' + index
  },
  {
    label: 'exemple_label_' + index,
    qualityMode: 'exemple_qualityMode_' + index,
    preferAudioOnly: 'exemple_preferAudioOnly_' + index,
    maxHeight: 'exemple_maxHeight_' + index,
    downloadDir: 'exemple_downloadDir_' + index,
    concurrent: 'exemple_concurrent_' + index
  }
  ];
  const presetsCreated = await Presets.insertMany(presetsDocs);
  count += presetsCreated.length;
  await logSeed({
    appName,
    feature: 'presets',
    modelName: 'Presets',
    schemaPath: path.join(__dirname, 'features', 'presets', 'model', 'presets.schema.js'),
    ids: presetsCreated.map((d) => d._id),
  });

  return { count };
};
