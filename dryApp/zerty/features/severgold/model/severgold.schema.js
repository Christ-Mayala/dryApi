const mongoose = require('mongoose');

const SevergoldSchema = new mongoose.Schema({
  Mays: { type: String, required: false, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
SevergoldSchema.index({ createdAt: -1 });
SevergoldSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = SevergoldSchema;
