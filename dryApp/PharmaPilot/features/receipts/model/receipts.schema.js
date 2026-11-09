const mongoose = require('mongoose');

/**
 * Ligne de reception. Une ligne decrit ce qui est physiquement recu pour un
 * produit et un lot donnes (quantite recue, quantite refusee, cout unitaire).
 */
const ReceiptLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Renseigne a la validation : lot effectivement mouvemente.
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null },
    lotNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    quantityReceived: { type: Number, required: true, min: 1 },
    quantityRejected: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, min: 0, default: null },
  },
  { _id: true }
);

/**
 * Reception fournisseur (bon de livraison).
 *
 * Cycle de vie : draft -> validated (transactionnel) ou draft -> cancelled.
 * La validation est la seule operation qui cree des mouvements d'entree et
 * alimente `stockBalances` ; elle est atomique et idempotente.
 */
const ReceiptsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    reference: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'validated', 'cancelled'], default: 'draft', index: true },
    lines: { type: [ReceiptLineSchema], default: [] },
    totalAmount: { type: Number, default: 0, min: 0 },
    validatedAt: { type: Date, default: null },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false }
);

ReceiptsSchema.index({ pharmacyId: 1, createdAt: -1 });
ReceiptsSchema.index({ pharmacyId: 1, status: 1 });

module.exports = ReceiptsSchema;
