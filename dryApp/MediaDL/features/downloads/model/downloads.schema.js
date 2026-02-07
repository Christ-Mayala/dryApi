const mongoose = require('mongoose');

const DownloadsSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  url: { type: String, required: true, trim: true },
  platform: { type: String, required: true, trim: true },
  mediaType: { type: String, enum: ['video', 'audio', 'image'], default: 'video' },
  filename: { type: String, trim: true },
  maxHeight: { type: Number },
  jobStatus: { type: String, enum: ['pending', 'running', 'done', 'error', 'cancelled'], default: 'pending', index: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  sizeBytes: { type: Number },
  durationMs: { type: Number },
  path: { type: String, trim: true },
  error: { type: String, trim: true },
  expiresAt: { type: Date },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  presetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Presets' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batches' }
}, {
  timestamps: true
});

DownloadsSchema.index({ createdAt: -1 });

module.exports = DownloadsSchema;
