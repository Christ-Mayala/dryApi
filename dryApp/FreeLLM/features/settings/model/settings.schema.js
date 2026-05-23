const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, unique: true },
  value: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

SettingsSchema.index({ key: 1 }, { unique: true });
SettingsSchema.index({ createdAt: -1 });

module.exports = SettingsSchema;
