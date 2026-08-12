const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  severity: {
    type: String,
    enum: ['critical', 'warning', 'info'],
    required: true,
    index: true,
  },
  event: {
    type: String,
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  traceId: {
    type: String,
    index: true,
  },
  userId: {
    type: String,
    index: true,
  },
  tenantId: {
    type: String,
    index: true,
  },
  requestId: {
    type: String,
    index: true,
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  channelsSent: {
    webhook: { generic: { type: Boolean, default: false }, slack: { type: Boolean, default: false }, discord: { type: Boolean, default: false } },
    email: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
  },
  acknowledged: {
    type: Boolean,
    default: false,
    index: true,
  },
  acknowledgedAt: {
    type: Date,
  },
  acknowledgedBy: {
    type: String,
  },
}, {
  timestamps: true,
  versionKey: false,
  collection: 'alerts',
});

AlertSchema.index({ severity: 1, timestamp: -1 });
AlertSchema.index({ event: 1, timestamp: -1 });
AlertSchema.index({ acknowledged: 1, timestamp: -1 });

module.exports = AlertSchema;
