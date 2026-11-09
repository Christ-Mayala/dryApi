const mongoose = require('mongoose');

/**
 * Lot de produits — porte la tracabilite (numero de lot + peremption).
 *
 * Le statut de cycle de vie du lot (perime / en quarantaine) est derive :
 *  - peremption : comparee dynamiquement a `expiryDate` (jamais stockee) ;
 *  - quarantaine : indicateur explicite `quarantined`.
 * Le champ `status` reste gere par le kernel (soft delete DRY).
 *
 * `tenantId` = organisation ; `pharmacyId` = etablissement (cloisonnement).
 */
const LotsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    lotNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true, index: true },
    receivedAt: { type: Date, default: Date.now },
    quantityReceived: { type: Number, default: 0, min: 0 },
    quarantined: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

LotsSchema.index({ pharmacyId: 1, productId: 1, lotNumber: 1 }, { unique: true });
LotsSchema.index({ pharmacyId: 1, expiryDate: 1 });

/** Perime ? (calcule, jamais stocke pour eviter toute desynchronisation). */
LotsSchema.virtual('expired').get(function () {
  return this.expiryDate ? this.expiryDate.getTime() < Date.now() : false;
});

module.exports = LotsSchema;
