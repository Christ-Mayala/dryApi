const mongoose = require('mongoose');

const ReviewsSchema = new mongoose.Schema({
  courseId: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true, trim: true },
  isApproved: { type: Boolean, default: false },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
ReviewsSchema.index({ createdAt: -1 });
ReviewsSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = ReviewsSchema;
