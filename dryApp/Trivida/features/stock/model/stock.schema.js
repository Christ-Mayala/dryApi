const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: Number },
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  activityId: { type: Number },
  minThreshold: { type: Number, default: 5 },
  barcode: { type: String },
  updatedAt: { type: Date },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

StockSchema.index({ userId: 1, name: 1 });
StockSchema.index({ userId: 1, activityId: 1 });

// Middleware: exclure les documents supprimés
StockSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = StockSchema;
