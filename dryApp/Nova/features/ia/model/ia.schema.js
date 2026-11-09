const mongoose = require('mongoose');

/**
 * RequeteIA = trace d'une interaction avec l'assistant IA de l'espace
 * (question, redaction, resume, traduction, remplissage automatique).
 *
 * Le plugin DRY derive `label` depuis `question` et ajoute slug/status/
 * deletedAt/createdBy/updatedBy.
 */
const IaSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    reponse: { type: String },
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
    modele: { type: String, default: 'nova-ia' },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    // Auteur de la requete : sert au filtrage de confidentialite (un membre ne
    // voit que son propre historique ; un administrateur voit tout).
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dureeMs: { type: Number },
    type: {
      type: String,
      enum: ['question', 'redaction', 'resume', 'traduction', 'autoremplissage'],
      default: 'question',
    },
  },
  { timestamps: true }
);

IaSchema.index({ type: 1 });
IaSchema.index({ pageId: 1 });

module.exports = IaSchema;
