const mongoose = require('mongoose');

/**
 * Modele = gabarit de page ou de base reutilisable (modele officiel, de la
 * communaute ou personnel).
 *
 * Le plugin DRY derive `label` depuis `nom` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const ModelesSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    description: { type: String },
    categorie: { type: String, enum: ['officiel', 'communaute', 'perso'], default: 'perso' },
    icone: { type: String, default: '🧩' },
    baseCible: { type: mongoose.Schema.Types.ObjectId, ref: 'Base' },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    contenu: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ModelesSchema.index({ categorie: 1 });
ModelesSchema.index({ espaceId: 1 });

module.exports = ModelesSchema;
