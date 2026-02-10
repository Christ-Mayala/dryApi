const mongoose = require('mongoose');

const VisiteSchema = new mongoose.Schema({
  bienId: { type: String, required: true, trim: true },
  clientId: { type: String, required: true, trim: true },
  dateVisite: { type: Date, required: true },
  statut: { type: String, required: true, trim: true },
  commentaire: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
VisiteSchema.index({ createdAt: -1 });
VisiteSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = VisiteSchema;
