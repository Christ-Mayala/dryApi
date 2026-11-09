const mongoose = require('mongoose');

/**
 * Fournisseur / grossiste.
 * `tenantId` = organisation ; `pharmacyId` = etablissement (cloisonnement).
 */
const SuppliersSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    name: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

SuppliersSchema.index({ pharmacyId: 1, name: 1 }, { unique: true });

module.exports = SuppliersSchema;
