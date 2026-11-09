const mongoose = require('mongoose');

/**
 * Connexion = integration tierce (Slack, GitHub, Jira, Google Drive, Figma...)
 * rattachee a un espace de travail.
 *
 * Le plugin DRY derive `label` depuis `nom` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const ConnexionsSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    nom: { type: String, required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ConnexionsSchema.index({ type: 1 });
ConnexionsSchema.index({ espaceId: 1 });

module.exports = ConnexionsSchema;
