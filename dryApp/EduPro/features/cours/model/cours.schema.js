const mongoose = require('mongoose');

const CoursSchema = new mongoose.Schema({
  titre: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  niveau: { type: String, required: true, trim: true },
  duree: { type: Number, required: true },
  prix: { type: Number, required: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
CoursSchema.index({ createdAt: -1 });
CoursSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = CoursSchema;
