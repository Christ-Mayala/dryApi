const mongoose = require('mongoose');

/**
 * Publication = expose une page a l'exterieur (web public, personnes invitees ou
 * lien d'invitation) avec un niveau d'acces donne.
 *
 * Le plugin DRY ajoute slug/label/status/deletedAt/createdBy/updatedBy.
 */
const PublicationsSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', required: true },
    portee: { type: String, enum: ['web', 'personnes', 'invite'], default: 'web' },
    domaine: { type: String },
    acces: {
      type: String,
      enum: ['lecture', 'commentaire', 'edition', 'complet'],
      default: 'lecture',
    },
    invites: [
      {
        email: { type: String },
        role: { type: String },
      },
    ],
    actif: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PublicationsSchema.index({ pageId: 1 });
PublicationsSchema.index({ actif: 1 });

module.exports = PublicationsSchema;
