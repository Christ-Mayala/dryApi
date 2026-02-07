const mongoose = require('mongoose');

const BatchesSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  sourceType: { type: String, required: true, trim: true },
  total: { type: Number, required: true },
  completed: { type: Number, required: true },
  failed: { type: Number, required: true },
  status: { type: String, required: true, trim: true },
  createdBy: { type: String, required: true, trim: true },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, required: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
BatchesSchema.index({ createdAt: -1 });
BatchesSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = BatchesSchema;
