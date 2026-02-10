const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  telephone: { type: String, required: true, trim: true },
  budget: { type: Number, required: true },
  recherche: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
ClientSchema.index({ createdAt: -1 });
ClientSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = ClientSchema;
