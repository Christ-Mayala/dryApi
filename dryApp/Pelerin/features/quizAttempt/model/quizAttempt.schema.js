const mongoose = require('mongoose');

// Une tentative de reponse a une question de quiz. "createdBy" (plugin global)
// porte l'identite utilisateur. Historique complet conserve (pas d'upsert) pour
// permettre des statistiques de progression dans le temps.
const QuizAttemptSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  selectedIndex: { type: Number, required: true, min: 0 },
  isCorrect: { type: Boolean, required: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

QuizAttemptSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = QuizAttemptSchema;
