const mongoose = require('mongoose');

// Contenu editorial d'une meditation quotidienne : verset + reflexion + priere
// guidee. Redige par l'equipe Pelerin (admin), lecture publique.
const MeditationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  bookCode: { type: String, required: true, trim: true, lowercase: true },
  chapter: { type: Number, required: true },
  verseStart: { type: Number, required: true },
  verseEnd: { type: Number },
  reflection: { type: String, required: true, trim: true },
  prayer: { type: String, required: true, trim: true },
  publishDate: { type: Date, default: Date.now }, // permet une rotation "verset du jour"
  label: { type: String, trim: true }
}, {
  timestamps: true
});

MeditationSchema.index({ publishDate: -1 });

module.exports = MeditationSchema;
