const mongoose = require('mongoose');

const RequestsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  platform: { type: String, required: true, trim: true },
  modelId: { type: String, required: true, trim: true },
  status: { type: String, required: true, trim: true },
  inputTokens: { type: Number, required: true, default: 0 },
  outputTokens: { type: Number, required: true, default: 0 },
  latencyMs: { type: Number, required: true, default: 0 },
  error: { type: String }
}, {
  timestamps: true
});

RequestsSchema.index({ createdAt: -1 });
RequestsSchema.index({ platform: 1 });
RequestsSchema.index({ status: 1 });
RequestsSchema.index({ userId: 1 });

module.exports = RequestsSchema;
