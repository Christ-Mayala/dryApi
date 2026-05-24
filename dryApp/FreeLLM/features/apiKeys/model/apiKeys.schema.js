const mongoose = require('mongoose');

const ApiKeysSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  platform: { type: String, required: true, trim: true },
  label: { type: String, trim: true, default: '' },
  encryptedKey: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  status: { 
    type: String, 
    required: true, 
    trim: true, 
    default: 'unknown', 
    enum: ['healthy', 'rate_limited', 'invalid', 'error', 'unknown'] 
  },
  enabled: { type: Boolean, required: true, default: true },
  lastCheckedAt: { type: Date }
}, {
  timestamps: true
});

ApiKeysSchema.index({ platform: 1 });
ApiKeysSchema.index({ createdAt: -1 });
ApiKeysSchema.index({ status: 1 });
ApiKeysSchema.index({ userId: 1 });

module.exports = ApiKeysSchema;
