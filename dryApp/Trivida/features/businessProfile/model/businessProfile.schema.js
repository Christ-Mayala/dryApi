const mongoose = require('mongoose');

const BusinessProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
  localId: { type: Number },
  businessName: { type: String },
  address: { type: String },
  phone: { type: String },
  email: { type: String },
  niu: { type: String },
  rccm: { type: String },
  logo: { type: String },
  paymentMethods: { type: String },
  terms: { type: String },
  createdAt: { type: Date },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

// Middleware: exclure les documents supprimés
BusinessProfileSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = BusinessProfileSchema;
