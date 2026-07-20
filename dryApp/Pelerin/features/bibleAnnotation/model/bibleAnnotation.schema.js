const mongoose = require('mongoose');

// Ce qu'un utilisateur attache a un verset precis (une version donnee) :
// favori, surlignage colore et/ou reflexion personnelle. Un seul document par
// (utilisateur, version, bookCode, chapter, verse) — voir upsert dans le controller.
// "createdBy" (ajoute automatiquement par le plugin mongoose global DRY) porte
// l'identite de l'utilisateur ; on ne le redeclare pas ici.
const BibleAnnotationSchema = new mongoose.Schema({
  version: { type: String, enum: ['LSG1910', 'DARBY', 'KJV'], required: true },
  bookCode: { type: String, required: true, trim: true, lowercase: true },
  chapter: { type: Number, required: true, min: 1 },
  verse: { type: Number, required: true, min: 1 },
  text: { type: String, trim: true }, // snapshot du texte du verset au moment de l'annotation (lecture offline)
  isFavorite: { type: Boolean, default: false },
  highlightColor: { type: String, enum: [null, 'gold', 'brown', 'rose', 'blue'], default: null },
  note: { type: String, trim: true, maxlength: 5000 },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

BibleAnnotationSchema.index({ createdBy: 1, version: 1, bookCode: 1, chapter: 1, verse: 1 });
BibleAnnotationSchema.index({ createdBy: 1, isFavorite: 1 });

module.exports = BibleAnnotationSchema;
