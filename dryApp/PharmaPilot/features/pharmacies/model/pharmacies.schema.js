const mongoose = require('mongoose');

/**
 * Pharmacie = etablissement pharmaceutique appartenant a une organisation.
 *
 * Distinction structurante :
 *  - `Organization` est le tenant : l'entite cliente qui paie l'abonnement ;
 *  - une organisation possede une ou plusieurs pharmacies (etablissements) et
 *    les supervise depuis un meme compte, tout en gardant des stocks separes ;
 *  - `pharmacyId` (ce document) porte le cloisonnement des donnees metier,
 *    tandis que `tenantId` pointe vers l'organisation proprietaire.
 */
const PharmaciesSchema = new mongoose.Schema(
  {
    // Organisation proprietaire (egale au `tenantId` des documents metier).
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    licenseNumber: { type: String, trim: true },
    // Identifie sans ambiguite une pharmacie de demonstration (donnees non reelles).
    isDemo: { type: Boolean, default: false },
    settings: {
      currency: { type: String, default: 'XAF' },
      lowStockThreshold: { type: Number, default: 10, min: 0 },
      expiryAlertDays: { type: Number, default: 90, min: 1 },
      allowNegativeStock: { type: Boolean, default: false },
    },
  },
  { timestamps: true, versionKey: false }
);

PharmaciesSchema.index({ organizationId: 1, name: 1 });

module.exports = PharmaciesSchema;
