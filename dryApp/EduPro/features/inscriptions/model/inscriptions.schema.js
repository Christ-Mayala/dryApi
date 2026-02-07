const mongoose = require('mongoose');

const InscriptionSchema = new mongoose.Schema({
  etudiantId: { type: String, required: true, trim: true },
  coursId: { type: String, required: true, trim: true },
  dateInscription: { type: Date, required: true },
  statut: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
InscriptionSchema.index({ createdAt: -1 });
InscriptionSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = InscriptionSchema;
