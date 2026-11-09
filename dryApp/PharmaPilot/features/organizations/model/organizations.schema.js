const mongoose = require('mongoose');

/**
 * Organisation = tenant PharmaPilot (l'entite cliente qui paie l'abonnement).
 *
 * A ne pas confondre avec une Pharmacie (etablissement) : une organisation
 * peut posseder plusieurs pharmacies (ex. trois officines a Brazzaville) et
 * les superviser depuis un meme compte, tout en conservant des stocks separes.
 *
 * `Organization._id` est le `tenantId` porte par les documents metier ; la
 * pharmacie concernee est identifiee par `pharmacyId`.
 */
const OrganizationsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    billingEmail: { type: String, trim: true, lowercase: true },
    plan: { type: String, default: 'standard' },
    // Identifie sans ambiguite une organisation de demonstration.
    isDemo: { type: Boolean, default: false },
    settings: {
      currency: { type: String, default: 'XAF' },
    },
  },
  { timestamps: true, versionKey: false }
);

OrganizationsSchema.index({ name: 1 });

module.exports = OrganizationsSchema;
