const mongoose = require('mongoose');

/**
 * Commentaire = note attachee a une page ou a un bloc precis (commentaire en
 * ligne sur un bloc de contenu).
 *
 * Le plugin DRY ajoute slug/label/status/deletedAt/createdBy/updatedBy.
 */
const CommentairesSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', index: true },
    blocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bloc' },
    auteurNom: { type: String, required: true },
    auteurAvatar: { type: String, default: null },
    contenu: { type: String, required: true },
    resolu: { type: Boolean, default: false },
    position: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

CommentairesSchema.index({ pageId: 1, resolu: 1 });

module.exports = CommentairesSchema;
