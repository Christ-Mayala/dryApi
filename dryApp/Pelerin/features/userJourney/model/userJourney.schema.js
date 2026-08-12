const mongoose = require('mongoose');

// Une etape de progression dans le parcours spirituel d'un utilisateur.
const JourneyStageSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  icon: { type: String, trim: true },
  requiredPoints: { type: Number, default: 0 },
  order: { type: Number, required: true },
}, { _id: false });

// Suivi de progression spirituelle d'un utilisateur (systeme d'evolution).
// Un document par utilisateur.
const UserJourneySchema = new mongoose.Schema({
  createdBy: { type: String, required: true, trim: true },
  points: { type: Number, default: 0 },
  currentStageKey: { type: String, trim: true, default: 'beginner' },
  completedMilestones: { type: [String], default: [] },
  streakDays: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  readingPlanDay: { type: Number, default: 1 },
  readingPlanId: { type: String, trim: true },
  label: { type: String, trim: true },
}, {
  timestamps: true
});

UserJourneySchema.index({ createdBy: 1 }, { unique: true });

module.exports = UserJourneySchema;
