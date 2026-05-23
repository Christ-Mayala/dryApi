const mongoose = require('mongoose');

const ModelsSchema = new mongoose.Schema({
  platform: { type: String, required: true, trim: true },
  modelId: { type: String, required: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  intelligenceRank: { type: Number, required: true },
  speedRank: { type: Number, required: true },
  sizeLabel: { type: String, required: true, trim: true, default: '' },
  rpmLimit: { type: Number },
  rpdLimit: { type: Number },
  tpmLimit: { type: Number },
  tpdLimit: { type: Number },
  monthlyTokenBudget: { type: String, required: true, trim: true, default: '' },
  contextWindow: { type: Number },
  enabled: { type: Boolean, required: true, default: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ModelsSchema.index({ platform: 1, modelId: 1 }, { unique: true });
ModelsSchema.index({ createdAt: -1 });
ModelsSchema.index({ status: 1 });

module.exports = ModelsSchema;
