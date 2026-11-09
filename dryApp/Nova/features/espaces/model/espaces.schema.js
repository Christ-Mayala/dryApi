const mongoose = require('mongoose');

/**
 * Espace = regroupement de premier niveau (comme un "Espace" Nova) dans lequel
 * sont ranges les pages, bases et modeles. Ex. : "Ingenierie", "Marketing".
 *
 * Le plugin global DRY ajoute automatiquement slug, label (derive de `nom`),
 * status, deletedAt, createdBy et updatedBy.
 */
const EspacesSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    icone: { type: String, default: '🏢' },
    description: { type: String },
    visibilite: { type: String, enum: ['ouvert', 'ferme', 'prive'], default: 'ouvert' },
    ordre: { type: Number, default: 0 },
    estPrive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EspacesSchema.index({ nom: 1 });
EspacesSchema.index({ ordre: 1 });

module.exports = EspacesSchema;
