const mongoose = require('mongoose');

/**
 * Journal des mouvements de stock — source de verite de toute variation.
 *
 * Aucune variation de stock ne peut exister sans un document ici. Un mouvement
 * n'est jamais modifie ni supprime silencieusement : une correction se fait par
 * un mouvement compensatoire (type 'adjustment' ou 'in'/'out' oppose).
 */
const StockMovementsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true, required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null, index: true },
    type: { type: String, enum: ['in', 'out', 'adjustment'], required: true, index: true },
    // Quantite toujours positive (lisibilite metier).
    quantity: { type: Number, required: true, min: 0 },
    // Variation signee appliquee au solde (+ entree, - sortie).
    signedQuantity: { type: Number, required: true },
    unit: { type: String, trim: true },
    reasonCode: {
      type: String,
      enum: ['receipt', 'sale', 'loss', 'breakage', 'donation', 'return_supplier', 'return_customer', 'correction', 'inventory', 'expiry', 'transfer'],
      required: true,
      index: true,
    },
    reason: { type: String, trim: true },
    sourceType: { type: String, enum: ['receipt', 'inventory', 'manual', 'sale', 'import'], required: true, index: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    balanceAfter: { type: Number },
    note: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

StockMovementsSchema.index({ pharmacyId: 1, occurredAt: -1 });
StockMovementsSchema.index({ pharmacyId: 1, productId: 1, occurredAt: -1 });
StockMovementsSchema.index({ pharmacyId: 1, sourceType: 1, sourceId: 1 });

module.exports = StockMovementsSchema;
