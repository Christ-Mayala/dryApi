const mongoose = require('mongoose');

/**
 * Categorie de produits.
 *
 * `tenantId` identifie l'organisation (cliente) ; `pharmacyId` identifie
 * l'etablissement : le nom reste unique au sein d'une meme pharmacie.
 */
const CategoriesSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true, versionKey: false }
);

CategoriesSchema.index({ pharmacyId: 1, name: 1 }, { unique: true });

module.exports = CategoriesSchema;
