const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: Number },
  type: { 
    type: String, 
    required: true, 
    enum: ['revenu', 'depense', 'loan_in', 'loan_out', 'loan_repayment_received', 'loan_repayment_sent'],
    index: true
  },
  category: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true, index: true },
  description: { type: String, default: '' },
  activityId: { type: mongoose.Schema.Types.Mixed }, // Mixed pour accepter nombres (SQLite) et ObjectId
  linkedId: { type: mongoose.Schema.Types.Mixed },   // Mixed pour accepter nombres (SQLite) et ObjectId
  moduleType: { type: String, enum: ['debt', 'activity', null] },
  items: { type: String },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1 });
TransactionSchema.index({ userId: 1, category: 1 });

TransactionSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = TransactionSchema;
