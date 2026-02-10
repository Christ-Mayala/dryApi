const mongoose = require('mongoose');

const BienSchema = new mongoose.Schema({
  titre: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  prix: { type: Number, required: true },
  type: { type: String, required: true, trim: true },
  surface: { type: Number, required: true },
  chambres: { type: Number, required: true },
  sallesDeBain: { type: Number, required: true },
  adresse: { type: String, required: true, trim: true },
  ville: { type: String, required: true, trim: true },
  codePostal: { type: String, required: true, trim: true },
  disponible: { type: Boolean, default: false },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
BienSchema.index({ createdAt: -1 });
BienSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = BienSchema;
