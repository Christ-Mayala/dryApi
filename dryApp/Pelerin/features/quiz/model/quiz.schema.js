const mongoose = require('mongoose');

// Une question de quiz biblique. Contenu editorial (admin). Les endpoints publics
// de lecture masquent volontairement "correctAnswerIndex" et "explanation" pour
// eviter de trivialiser la reponse — voir quiz.getAll/getById controllers.
const QuizSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length >= 2,
      message: 'Il faut au moins 2 options de reponse',
    },
  },
  correctAnswerIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, required: true, trim: true },
  theme: { type: String, trim: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  bookCode: { type: String, trim: true, lowercase: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

QuizSchema.index({ theme: 1, difficulty: 1 });

module.exports = QuizSchema;
