const mongoose = require('mongoose');

/**
 * Alerte operationnelle derivee de donnees verifiables (soldes et lots) :
 *  - `out_of_stock` : quantite agregee nulle ;
 *  - `low_stock`    : quantite agregee <= seuil de reapprovisionnement ;
 *  - `expired`      : lot dont la peremption est depassee et au stock > 0 ;
 *  - `expiring`     : lot dont la peremption approche (delai pharmacie).
 *
 * Une alerte n'est jamais saisie manuellement : elle est (re)calculee par le
 * moteur d'alertes. Seule sa prise en charge (`status`, `note`) est manuelle.
 */
const AlertsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true, required: true },
    type: { type: String, enum: ['low_stock', 'out_of_stock', 'expiring', 'expired'], required: true, index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null, index: true },
    message: { type: String, required: true },
    value: { type: Number, default: 0 },
    threshold: { type: Number, default: null },
    expiryDate: { type: Date, default: null },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved', 'ignored'], default: 'open', index: true },
    note: { type: String, trim: true },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

AlertsSchema.index({ pharmacyId: 1, type: 1, status: 1 });
AlertsSchema.index({ pharmacyId: 1, productId: 1, lotId: 1, type: 1, status: 1 });

module.exports = AlertsSchema;
