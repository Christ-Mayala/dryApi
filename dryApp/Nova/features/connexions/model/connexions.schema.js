const mongoose = require('mongoose');
const {
  chiffrerConfig,
  dechiffrerConfig,
  masquerConfig,
} = require('../../../services/crypto.service');

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

// Chiffrement au repos : les secrets ne sont jamais persistés en clair.
ConnexionsSchema.pre('save', function () {
  if (this.isModified('config')) this.config = chiffrerConfig(this.config);
});

ConnexionsSchema.pre('findOneAndUpdate', function () {
  const maj = this.getUpdate();
  if (maj?.$set?.config) maj.$set.config = chiffrerConfig(maj.$set.config);
  if (maj?.config) maj.config = chiffrerConfig(maj.config);
});

// Les services internes (test de connexion) reçoivent la configuration en clair.
ConnexionsSchema.post('init', function () {
  this.config = dechiffrerConfig(this.config);
});

// Les réponses API ne contiennent jamais les secrets, même en cas de populate.
ConnexionsSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.config = masquerConfig(ret.config);
    return ret;
  },
});

module.exports = ConnexionsSchema;
