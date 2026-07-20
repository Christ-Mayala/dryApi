const mongoose = require('mongoose');

// Un livre biblique, independant de la version (LSG1910 / DARBY / KJV partagent le meme decoupage).
// NOTE: le champ "slug" est reserve par le plugin mongoose global DRY (auto-genere, unique, sparse) :
// on utilise donc "code" comme identifiant metier stable inter-versions (ex: "jean") pour ne pas
// entrer en collision avec ce champ technique.
const BibleBookSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, lowercase: true, unique: true }, // ex: "jean"
  nameFr: { type: String, required: true, trim: true }, // ex: "Jean"
  nameEn: { type: String, required: true, trim: true }, // ex: "John"
  testament: { type: String, enum: ['AT', 'NT'], required: true },
  order: { type: Number, required: true }, // ordre canonique 1-66
  chapterCount: { type: Number, required: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

BibleBookSchema.index({ order: 1 });
BibleBookSchema.index({ testament: 1, order: 1 });

module.exports = BibleBookSchema;
