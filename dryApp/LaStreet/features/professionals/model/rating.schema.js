const mongoose = require('mongoose');

const ProfessionalRatingSchema = new mongoose.Schema(
  {
    professional: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true, versionKey: false },
);

ProfessionalRatingSchema.index({ professional: 1, user: 1 }, { unique: true });

module.exports = ProfessionalRatingSchema;
