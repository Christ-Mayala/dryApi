const mongoose = require('mongoose');

const RequestsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  platform: { type: String, required: true, trim: true, index: true },
  modelId: { type: String, required: true, trim: true, index: true },
  status: { type: String, required: true, trim: true, index: true },
  inputTokens: { type: Number, required: true, default: 0 },
  outputTokens: { type: Number, required: true, default: 0 },
  latencyMs: { type: Number, required: true, default: 0 },
  error: { type: String, index: true },
  keyId: { type: mongoose.Schema.Types.ObjectId },
  taskType: { type: String, trim: true, index: true },
  fallbackCount: { type: Number, default: 0 },
  requestId: { type: String, trim: true },
  slug: { type: String, trim: true, unique: true, sparse: true }
}, {
  timestamps: true
});

RequestsSchema.index({ createdAt: -1 });
RequestsSchema.index({ platform: 1, status: 1 });
RequestsSchema.index({ userId: 1, createdAt: -1 });
RequestsSchema.index({ modelId: 1, createdAt: -1 });
RequestsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = RequestsSchema;
