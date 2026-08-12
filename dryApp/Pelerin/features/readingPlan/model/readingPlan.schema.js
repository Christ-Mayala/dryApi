const mongoose = require('mongoose');

// Un jour d'un plan de lecture biblique : reference de versets/chapitres a lire.
// Le plan complet ("Bible en 1 an") est constitue de 365 documents de ce type.
const ReadingPlanDaySchema = new mongoose.Schema({
  day: { type: Number, required: true, min: 1, max: 365 },
  bookCode: { type: String, required: true, trim: true, lowercase: true },
  chapter: { type: Number, required: true, min: 1 },
  verseStart: { type: Number, min: 1 },
  verseEnd: { type: Number, min: 1 },
  theme: { type: String, trim: true },
  reflection: { type: String, trim: true },
  estimatedMinutes: { type: Number, default: 10 },
  label: { type: String, trim: true },
}, { _id: false });

// Plan de lecture biblique structure (ex: "Bible en 1 an", "Nouveau Testament en 90 jours").
// Contenu public en lecture, ecriture reservee a l'admin.
const ReadingPlanSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  theme: { type: String, trim: true },
  icon: { type: String, trim: true, default: 'calendar-outline' },
  durationDays: { type: Number, required: true, min: 1 },
  isPublished: { type: Boolean, default: true },
  days: { type: [ReadingPlanDaySchema], default: [] },
  label: { type: String, trim: true },
}, {
  timestamps: true
});

ReadingPlanSchema.index({ isPublished: 1, createdAt: -1 });
ReadingPlanSchema.index({ 'days.day': 1 });

module.exports = ReadingPlanSchema;
