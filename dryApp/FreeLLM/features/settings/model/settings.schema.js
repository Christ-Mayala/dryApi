const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, unique: true },
  value: { type: String, required: true, trim: true },
  label: { type: String, trim: true },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true
});

SettingsSchema.index({ key: 1 });
SettingsSchema.index({ deletedAt: 1 });

module.exports = SettingsSchema;