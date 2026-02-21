const mongoose = require('mongoose');

const CoursesSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true },
  level: { type: String, required: true, trim: true },
  categoryId: { type: String, required: true, trim: true },
  trailerUrl: { type: String, required: true, trim: true },
  contentUrl: { type: String, required: true, trim: true },
  isPublished: { type: Boolean, default: false },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
CoursesSchema.index({ createdAt: -1 });
CoursesSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = CoursesSchema;
