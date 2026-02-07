const mongoose = require('mongoose');

const EtudiantSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  telephone: { type: String, required: true, trim: true },
  niveau: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
EtudiantSchema.index({ createdAt: -1 });
EtudiantSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = EtudiantSchema;
