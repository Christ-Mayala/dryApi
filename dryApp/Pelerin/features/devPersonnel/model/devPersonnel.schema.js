const mongoose = require('mongoose');

const THEMES = [
  'discipline', 'confiance', 'courage', 'patience', 'amour', 'pardon',
  'humilite', 'perseverance', 'leadership', 'identite',
];

// Contenu de developpement personnel centre sur Christ, organise par theme.
// Redige par l'equipe Pelerin, lecture publique.
const DevPersonnelSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  theme: { type: String, enum: THEMES, required: true },
  content: { type: String, required: true, trim: true },
  bookCode: { type: String, trim: true, lowercase: true },
  chapter: { type: Number },
  verseStart: { type: Number },
  verseEnd: { type: Number },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

DevPersonnelSchema.index({ theme: 1, createdAt: -1 });
DevPersonnelSchema.statics.THEMES = THEMES;

module.exports = DevPersonnelSchema;
