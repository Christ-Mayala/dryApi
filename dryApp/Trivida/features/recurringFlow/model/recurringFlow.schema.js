const mongoose = require('mongoose');

/**
 * Flux financier récurrent (revenu ou charge prévisionnelle).
 *
 * Miroir de la table SQLite `recurring_flows` du client. Les dates sont
 * stockées en epoch milliseconds côté client : on les garde ici en `Date`
 * (Mongoose) car `toSimpleValue()` côté client les reconvertit en epoch ms au
 * pull — le round-trip reste donc faithful.
 *
 * Les `enum` sont volontairement permissifs : le client emploie `revenu` /
 * `depense` (et accepte `income` en lecture) pour `type`, et `daily` peut
 * être produit par la détection de fréquence. Un enum strict rejetterait des
 * données valides et bloquerait la sync.
 */
const RecurringFlowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String },
  localId: { type: Number },

  label: { type: String, required: true },
  type: { type: String, enum: ['revenu', 'depense', 'income', 'expense'], required: true },
  amount: { type: Number, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  category: { type: String, default: null },

  // Epoch ms — voir commentaire d'en-tête.
  nextDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  isActive: { type: Boolean, default: true },

  // Soft delete
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

// La prévision de trésorerie trie sur (isActive, nextDate).
RecurringFlowSchema.index({ userId: 1, isActive: 1, nextDate: 1 });

// Middleware: exclure les documents supprimés
RecurringFlowSchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = RecurringFlowSchema;
