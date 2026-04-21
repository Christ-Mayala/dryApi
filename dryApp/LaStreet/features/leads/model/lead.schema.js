const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    serviceType: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: ['open', 'assigned', 'closed'],
      default: 'open',
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByRole: { type: String, enum: ['client', 'professional'], required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    estimatedPrice: { type: Number },
    unlockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPremiumCreator: { type: Boolean, default: false },
    urgency: {
      type: String,
      enum: ['aujourd-hui', 'demain', 'flexible'],
      default: 'flexible'
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

module.exports = LeadSchema;
