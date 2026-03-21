const mongoose = require('mongoose');

const LeadResponseSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the professional (User with role 'prestataire')
    required: true
  },
  message: {
    type: String,
    required: [true, 'Un message est obligatoire pour postuler']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a professional can only respond once to a lead
LeadResponseSchema.index({ leadId: 1, professionalId: 1 }, { unique: true });

module.exports = LeadResponseSchema;
