const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String },
  localId: { type: Number },  type: { 
    type: String, 
    required: true,
    enum: ['revenu', 'depense', 'loan_in', 'loan_out', 'loan_repayment_received', 'loan_repayment_sent', 'retrait_epargne'],
    index: true
  },
  category: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true, index: true },
  description: { type: String, default: '' },
  activityId: { type: mongoose.Schema.Types.Mixed }, // Mixed pour accepter nombres (SQLite) et ObjectId
  linkedId: { type: mongoose.Schema.Types.Mixed },   // Mixed pour accepter nombres (SQLite) et ObjectId
  moduleType: { type: String, enum: ['debt', 'activity', 'activity_recette', 'savings', 'invoice', null] },
  isBusiness: { type: Number, default: 0 }, // 1 = transaction professionnelle (recette/vente)
  items: { type: String },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1 });
TransactionSchema.index({ userId: 1, category: 1 });

TransactionSchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = TransactionSchema;
