const mongoose = require('mongoose');

/**
 * Message = message de la messagerie temps réel d'un espace d'équipe.
 *
 * Le plugin DRY ajoute slug/label/status/deletedAt/createdBy/updatedBy.
 */
const MessagesSchema = new mongoose.Schema(
  {
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace', required: true, index: true },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    auteurNom: { type: String, trim: true },
    auteurAvatar: { type: String, default: null },
    contenu: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

MessagesSchema.index({ espaceId: 1, createdAt: -1 });

module.exports = MessagesSchema;
