const mongoose = require('mongoose');

/**
 * Favori = epingle une page dans la liste des favoris d'un utilisateur, avec un
 * ordre d'affichage personnalise.
 *
 * Le plugin DRY ajoute slug/label/status/deletedAt/createdBy/updatedBy.
 */
const FavorisSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', required: true },
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    ordre: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FavorisSchema.index({ utilisateurId: 1, ordre: 1 });
FavorisSchema.index({ pageId: 1 });

module.exports = FavorisSchema;
