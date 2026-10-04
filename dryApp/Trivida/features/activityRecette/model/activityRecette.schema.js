const mongoose = require('mongoose');

const ActivityRecetteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String },
  localId: { type: Number },
  activityId: { type: Number },
  customerId: { type: Number },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  notes: { type: String },
  // Facture à l'origine de cet encaissement (migration client 17).
  // Avant, le lien n'existait que dans `notes` ('Paiement Facture FAC-…'),
  // ce qui rendait le rapprochement fragile : impossible de désindexer, et
  // deux factures aux numéros proches pouvaient être confondues. Absent sur
  // une recette saisie à la main — ce n'est alors pas une vente facturée.
  invoiceId: { type: Number },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

ActivityRecetteSchema.index({ userId: 1, activityId: 1 });
ActivityRecetteSchema.index({ userId: 1, invoiceId: 1 }, { sparse: true });

// Middleware: exclure les documents supprimés
ActivityRecetteSchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = ActivityRecetteSchema;
