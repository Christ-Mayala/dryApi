const mongoose = require('mongoose');

const ProductCatalogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: String },
  barcode: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  price_suggested: { type: Number, default: 0 },
  updatedAt: { type: Date },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

ProductCatalogSchema.index({ userId: 1, barcode: 1 }, { unique: true });

// Middleware: exclure les documents supprimés
ProductCatalogSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = ProductCatalogSchema;
