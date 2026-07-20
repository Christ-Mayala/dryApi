const mongoose = require('mongoose');

// Un lien souple vers un autre contenu de l'app — pas de "ref" Mongoose classique
// car les cibles (verset biblique versionne, parcours, meditation...) vivent dans
// des collections differentes et n'ont pas toutes besoin d'etre peuplees.
const NoteLinkSchema = new mongoose.Schema({
  kind: { type: String, enum: ['verse', 'parcours', 'meditation', 'goal'], required: true },
  label: { type: String, required: true, trim: true }, // texte affiche, ex: "Matthieu 6:14"
  // Rempli seulement si kind === 'verse'
  version: { type: String, enum: ['LSG1910', 'DARBY', 'KJV'] },
  bookCode: { type: String, trim: true, lowercase: true },
  chapter: { type: Number },
  verse: { type: Number },
  // Rempli pour les autres kinds (parcours, meditation, goal)
  refId: { type: mongoose.Schema.Types.ObjectId },
}, { _id: false });

// Bloc-notes spirituel façon Notion : documents et dossiers dans une seule
// collection auto-referencee (parentId), 100% prive (toujours filtre par
// createdBy dans les controllers — jamais de lecture croisee entre users).
const NotesSchema = new mongoose.Schema({
  type: { type: String, enum: ['folder', 'document'], required: true, default: 'document' },
  title: { type: String, required: true, trim: true },
  content: { type: String, trim: true, default: '' }, // markdown/texte libre, vide pour un dossier
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notes', default: null },
  links: { type: [NoteLinkSchema], default: [] },
  color: { type: String, trim: true }, // accent visuel optionnel (reprend la palette de highlight)
  tags: { type: [String], default: [] },
  isFavorite: { type: Boolean, default: false },
  lastAccessedAt: { type: Date },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

NotesSchema.index({ createdBy: 1, parentId: 1 });
NotesSchema.index({ createdBy: 1, title: 'text', content: 'text' });

module.exports = NotesSchema;
