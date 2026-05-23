const mongoose = require('mongoose');

const FallbackConfigSchema = new mongoose.Schema({
  modelDbId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Models' },
  priority: { type: Number, required: true },
  enabled: { type: Boolean, required: true, default: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

FallbackConfigSchema.index({ modelDbId: 1 }, { unique: true });
FallbackConfigSchema.index({ priority: 1 });
FallbackConfigSchema.index({ createdAt: -1 });

module.exports = FallbackConfigSchema;
