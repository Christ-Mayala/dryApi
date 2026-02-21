const mongoose = require('mongoose');

const StudentsSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, required: true, trim: true },
  preferences: { type: Array, default: [] },
  balance: { type: Number, required: true },
  enrolledCourses: { type: Array, default: [] },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
StudentsSchema.index({ createdAt: -1 });
StudentsSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = StudentsSchema;
