const mongoose = require('mongoose');

const SubscriptionRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['starter', 'standard', 'premium', 'pay-per-lead'],
    required: true
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  // Option 1 : code de transaction Mobile Money
  transactionCode: { type: String, trim: true },
  // Option 2 : URL Cloudinary de la capture d'écran
  proofImage: { type: String },
  proofPublicId: { type: String }, // Cloudinary public_id pour suppression
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: { type: String },
}, { timestamps: true });

module.exports = SubscriptionRequestSchema;
