const mongoose = require('mongoose');

// Progression d'un utilisateur sur un parcours donne. "createdBy" (auto, plugin
// global) porte l'identite de l'utilisateur ; un seul document par (user, parcours).
const ParcoursProgressSchema = new mongoose.Schema({
  parcoursId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parcours', required: true },
  currentStepOrder: { type: Number, default: 1 },
  completedSteps: { type: [Number], default: [] },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  journalNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notes', default: null },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ParcoursProgressSchema.index({ createdBy: 1, parcoursId: 1 }, { unique: true });

module.exports = ParcoursProgressSchema;
