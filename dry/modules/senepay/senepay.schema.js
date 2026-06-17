const mongoose = require('mongoose');

/**
 * Schéma de paiement SenePay
 * Stocke chaque tentative de paiement avec sa référence lisible
 * et permet de retrouver l'utilisateur dans le webhook.
 */
const SenepayPaymentSchema = new mongoose.Schema({

  // Référence lisible générée côté serveur : DRY-20260607-ABCD1234
  orderReference: { type: String, required: true, unique: true, index: true },

  // Utilisateur qui a initié le paiement
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userEmail: { type: String, required: true },
  userName:  { type: String, default: '' },

  // Détails du paiement
  amount:      { type: Number, required: true },
  currency:    { type: String, default: 'XAF' },
  description: { type: String, default: '' },

  // Retour SenePay
  sessionToken:  { type: String, default: null }, // Checkout hébergé
  payinToken:    { type: String, default: null }, // Paiement direct
  transactionId: { type: String, default: null }, // SENEPAY_PAYIN_xxx
  operator:      { type: String, default: null },

  // Statut
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'expired'],
    default: 'pending',
    index: true,
  },

  // Frais
  fees:      { type: Number, default: 0 },
  netAmount: { type: Number, default: 0 },

  paidAt: { type: Date, default: null },

}, {
  timestamps: true,
  versionKey: false,
  collection: 'senepay_payments',
});

module.exports = SenepayPaymentSchema;
