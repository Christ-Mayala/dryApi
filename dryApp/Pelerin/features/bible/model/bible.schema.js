const mongoose = require('mongoose');

const BIBLE_VERSIONS = ['LSG1910', 'DARBY', 'KJV'];

// Un verset biblique pour une version donnee. "bookCode" fait reference au champ
// "code" de BibleBook (features/bibleBook) : identifiant stable inter-versions
// (ex: "jean"), independant du nom affiche qui varie par langue ("Jean" / "John").
const BibleVerseSchema = new mongoose.Schema({
  version: { type: String, enum: BIBLE_VERSIONS, required: true },
  bookCode: { type: String, required: true, trim: true, lowercase: true },
  book: { type: String, required: true, trim: true }, // nom affiche dans la langue de la version
  testament: { type: String, enum: ['AT', 'NT'], required: true },
  chapter: { type: Number, required: true, min: 1 },
  verse: { type: Number, required: true, min: 1 },
  text: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Un seul verset par (version, livre, chapitre, numero de verset)
BibleVerseSchema.index({ version: 1, bookCode: 1, chapter: 1, verse: 1 }, { unique: true });
// Lecture d'un chapitre entier (le cas d'usage le plus frequent)
BibleVerseSchema.index({ version: 1, bookCode: 1, chapter: 1 });
// Recherche plein texte de passages
BibleVerseSchema.index({ text: 'text' });

BibleVerseSchema.statics.VERSIONS = BIBLE_VERSIONS;

module.exports = BibleVerseSchema;
