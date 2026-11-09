const mongoose = require('mongoose');

/**
 * Solde de stock par (produit, lot).
 *
 * Projection controlee du journal `stockMovements` : elle doit rester
 * rapprochable a tout moment (voir lib/stock.service.js#computeJournalBalance).
 * Elle n'est jamais modifiee directement par un utilisateur.
 */
const StockBalancesSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true, required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null, index: true },
    quantityOnHand: { type: Number, default: 0 },
    quantityReserved: { type: Number, default: 0, min: 0 },
    lastMovementAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

StockBalancesSchema.index({ pharmacyId: 1, productId: 1, lotId: 1 }, { unique: true });

module.exports = StockBalancesSchema;
