const mongoose = require('mongoose');

const PresetsSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  qualityMode: { type: String, required: true, trim: true },
  preferAudioOnly: { type: Boolean, default: false },
  maxHeight: { type: Number, required: true },
  downloadDir: { type: String, required: true, trim: true },
  concurrent: { type: Number, required: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
PresetsSchema.index({ createdAt: -1 });
PresetsSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = PresetsSchema;
