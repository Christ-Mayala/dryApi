const mongoose = require('mongoose');

/**
 * Parametre = reglages de l'espace de travail (apparence, police, langue, plan,
 * notifications e-mail...).
 *
 * Le plugin DRY derive `label` depuis `nomEspace` et ajoute slug/status/
 * deletedAt/createdBy/updatedBy.
 */
const ParametresSchema = new mongoose.Schema(
  {
    nomEspace: { type: String, required: true },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    icone: { type: String, default: '🪐' },
    domaine: { type: String },
    apparence: { type: String, enum: ['clair', 'sombre', 'systeme'], default: 'clair' },
    police: { type: String, enum: ['defaut', 'serif', 'mono'], default: 'defaut' },
    langue: { type: String, default: 'fr' },
    notifEmail: { type: Boolean, default: true },
    plan: { type: String, enum: ['gratuit', 'plus', 'entreprise'], default: 'gratuit' },
  },
  { timestamps: true }
);

ParametresSchema.index({ espaceId: 1 });

module.exports = ParametresSchema;
