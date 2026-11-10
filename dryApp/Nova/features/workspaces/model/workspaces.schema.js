const mongoose = require('mongoose');

/**
 * Workspace = espace de travail de premier niveau (au-dessus des espaces
 * d'equipe). Un utilisateur peut en posseder jusqu'a 5 ; basculer d'un
 * workspace a l'autre change l'integralite du contenu affiche (pages,
 * espaces d'equipe, favoris...), comme dans Notion.
 *
 * Le plugin global DRY ajoute automatiquement slug, label (derive de `nom`),
 * status, deletedAt, createdBy et updatedBy.
 */
const WorkspacesSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    icone: { type: String, default: '🏠' },
    description: { type: String },
    ordre: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WorkspacesSchema.index({ nom: 1 });
WorkspacesSchema.index({ ordre: 1 });

module.exports = WorkspacesSchema;
