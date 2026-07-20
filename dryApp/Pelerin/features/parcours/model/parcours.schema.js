const mongoose = require('mongoose');

// Une etape d'un parcours spirituel : lecture, meditation, question de reflexion,
// exercice pratique. Contenu editorial (redige par l'equipe Pelerin), pas par les users.
const ParcoursStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  // Reference de lecture, independante de la version (resolue cote client avec la
  // version preferee de l'utilisateur, comme pour bibleAnnotation).
  bookCode: { type: String, trim: true, lowercase: true },
  chapter: { type: Number },
  verseStart: { type: Number },
  verseEnd: { type: Number },
  meditation: { type: String, trim: true }, // texte de reflexion redige pour l'etape
  reflectionQuestion: { type: String, trim: true },
  practicalExercise: { type: String, trim: true },
}, { _id: false });

// Un parcours spirituel guide (ex: "Decouvrir Jesus", "Apprendre le pardon").
// Contenu public en lecture, ecriture reservee a l'admin (buildCrudRouter).
const ParcoursSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  theme: { type: String, trim: true }, // ex: "pardon", "identite", "discipline"
  icon: { type: String, trim: true, default: 'trail-sign-outline' }, // nom d'icone Ionicons
  estimatedDays: { type: Number, default: 7 },
  isPublished: { type: Boolean, default: true },
  steps: { type: [ParcoursStepSchema], default: [] },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ParcoursSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = ParcoursSchema;
