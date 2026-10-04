const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String },
  localId: { type: Number },
  invoiceNumber: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.Mixed }, // Mixed pour accepter nombres (SQLite)
  amount: { type: Number, required: true },
  status: { type: String, required: true, default: 'impayée', enum: ['payée', 'impayée', 'payé', 'impayé', 'en attente'] },
  date: { type: Date, required: true },
  dueDate: { type: Date },
  notes: { type: String },
  pdfPath: { type: String },
  // ── Activité de la vente (migration client 17) ──
  // Rattachement EXPLICITE de la facture à une activité, figé au moment de la
  // vente. Avant, la facture n'était reliée que par customers.activityId côté
  // client : rattacher le client à une autre activité déplaçait ses factures
  // passées, et une facture payée pour un client sans activité n'entrait dans
  // AUCUNE activité. Optionnel : les factures antérieures à la migration n'ont
  // pas cette notion et restent valables telles quelles.
  activityId: { type: Number },
  // ── Détail TVA ──
  // `amount` reste le TTC (ce que le client a payé) et garde son sens depuis la
  // première version. Ces trois champs ne sont renseignés que si la TVA a été
  // saisie : sur une facture sans TVA ils restent absents, ce qui ne doit pas
  // être confondu avec un taux de 0 %.
  amountHt: { type: Number },   // Montant hors taxes
  taxRate: { type: Number },    // Taux appliqué, en pourcentage (18.9 = 18,9 %)
  taxAmount: { type: Number },  // Montant de la TVA
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

InvoiceSchema.index({ userId: 1, invoiceNumber: 1 });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, activityId: 1, date: -1 });

InvoiceSchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = InvoiceSchema;
