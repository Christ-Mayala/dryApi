const mongoose = require('mongoose');

/**
 * Notification = message destine a un utilisateur (mention, commentaire,
 * partage, rappel ou message systeme) et rattache a une page.
 *
 * Le plugin DRY derive `label` depuis `titre` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const NotificationsSchema = new mongoose.Schema(
  {
    destinataireId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['mention', 'commentaire', 'partage', 'rappel', 'systeme'],
      default: 'systeme',
    },
    titre: { type: String, required: true },
    message: { type: String },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    lu: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationsSchema.index({ destinataireId: 1, lu: 1 });

module.exports = NotificationsSchema;
