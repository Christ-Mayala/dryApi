const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema({
  studentId: { type: String, required: true, trim: true },
  items: { type: Array, default: [] },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { type: String, required: true, trim: true },
  paymentMethod: { type: String, required: true, trim: true },
  transactionId: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
OrdersSchema.index({ createdAt: -1 });
OrdersSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = OrdersSchema;
