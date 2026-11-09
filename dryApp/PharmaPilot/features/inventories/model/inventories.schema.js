const mongoose = require('mongoose');

/**
 * Ligne d'inventaire.
 *
 * `theoreticalQuantity` est la quantite figee au moment du snapshot (ouverture
 * de la session). Les mouvements restent autorises pendant l'inventaire : a la
 * validation, l'ecart reel est recalcule en tenant compte des mouvements
 * intervenus APRES le snapshot (cf. `movementsSinceSnapshot`).
 */
const InventoryLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null },
    theoreticalQuantity: { type: Number, default: 0 },
    countedQuantity: { type: Number, default: null, min: 0 },
    difference: { type: Number, default: 0 },
    // Renseignes a la validation (approche « mouvements autorises »).
    theoreticalAtValidation: { type: Number, default: null },
    movementsSinceSnapshot: { type: Number, default: null },
    justification: { type: String, trim: true },
  },
  { _id: true }
);

/**
 * Session d'inventaire.
 *
 * Cycle de vie : draft (comptage) -> validated (ajustements generes) ou
 * draft -> cancelled. La validation ne reecrit jamais l'historique : elle
 * produit des mouvements d'ajustement traces (`reasonCode: inventory`).
 */
const InventoriesSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    scope: { type: String, enum: ['full', 'partial'], default: 'full' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // Instant du gel des quantites theoriques : sert au recalcul des ecarts
    // en tenant compte des mouvements posterieurs au snapshot.
    snapshotAt: { type: Date, default: null },
    note: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'validated', 'cancelled'], default: 'draft', index: true },
    lines: { type: [InventoryLineSchema], default: [] },
    validatedAt: { type: Date, default: null },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false }
);

InventoriesSchema.index({ pharmacyId: 1, createdAt: -1 });
InventoriesSchema.index({ pharmacyId: 1, status: 1 });

module.exports = InventoriesSchema;
