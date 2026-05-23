const mongoose = require('mongoose');

const ApiKeysSchema = new mongoose.Schema({
  platform: { type: String, required: true, trim: true },
  label: { type: String, trim: true, default: '' },
  encryptedKey: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  status: { type: String, required: true, trim: true, default: 'unknown' },
  enabled: { type: Boolean, required: true, default: true },
  lastCheckedAt: { type: Date },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ApiKeysSchema.index({ platform: 1 });
ApiKeysSchema.index({ createdAt: -1 });
ApiKeysSchema.index({ status: 1 });

module.exports = ApiKeysSchema;
