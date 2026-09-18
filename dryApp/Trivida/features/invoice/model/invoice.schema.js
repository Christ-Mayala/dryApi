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
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

InvoiceSchema.index({ userId: 1, invoiceNumber: 1 });
InvoiceSchema.index({ userId: 1, status: 1 });

InvoiceSchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = InvoiceSchema;
