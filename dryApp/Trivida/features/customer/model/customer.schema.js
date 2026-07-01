const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: Number },
  name: { type: String, required: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String },
  totalDebt: { type: Number, default: 0 },
  activityId: { type: mongoose.Schema.Types.Mixed }, // Mixed pour accepter nombres (SQLite) et ObjectId
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

CustomerSchema.index({ userId: 1, name: 1 });
CustomerSchema.index({ userId: 1, activityId: 1 });

CustomerSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = CustomerSchema;
