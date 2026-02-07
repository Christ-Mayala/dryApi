const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'login', 'logout', 'view', 'export']
  },
  resourceType: {
    type: String,
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  userEmail: {
    type: String,
    required: false
  },
  tenantId: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index pour les performances
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, resourceType: 1 });

module.exports = AuditLogSchema;
