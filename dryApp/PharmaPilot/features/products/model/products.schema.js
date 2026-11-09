const mongoose = require('mongoose');

/**
 * Produit pharmaceutique (fiche de reference).
 * Le stock lui-meme n'est jamais porte par cette collection : il est derive
 * des lots (collection `lots`) et des soldes (`stockBalances`).
 *
 * `tenantId` = organisation ; `pharmacyId` = etablissement (cloisonnement).
 */
const ProductsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null, index: true },
    form: {
      type: String,
      enum: ['comprime', 'sirop', 'gelule', 'injectable', 'pommade', 'collyre', 'autre'],
      default: 'comprime',
    },
    unit: { type: String, default: 'boite', trim: true },
    // Conversion explicite entre unite de conditionnement et unite de base
    // (ex: 1 boite = 20 comprimes). Jamais de conversion implicite.
    unitConversion: {
      baseUnit: { type: String, trim: true },
      factor: { type: Number, min: 0 },
    },
    dosage: { type: String, trim: true },
    barcode: { type: String, trim: true },
    price: { type: Number, min: 0, default: null },
    reorderThreshold: { type: Number, min: 0, default: 10 },
    minStock: { type: Number, min: 0, default: 0 },
    prescriptionRequired: { type: Boolean, default: false },
    description: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

ProductsSchema.index({ pharmacyId: 1, sku: 1 }, { unique: true });
ProductsSchema.index({ pharmacyId: 1, barcode: 1 }, { sparse: true });
ProductsSchema.index({ pharmacyId: 1, name: 1 });

module.exports = ProductsSchema;
