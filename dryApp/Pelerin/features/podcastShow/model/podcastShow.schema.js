const mongoose = require('mongoose');

const CATEGORIES = ['enseignement', 'temoignage', 'etude-biblique', 'actualite', 'louange', 'autre'];

// Une emission de podcast (regroupe des episodes par saison). Contenu
// editorial : lecture publique, ecriture admin (upload de couverture via
// dryApp/Pelerin/services/upload.service.js).
const PodcastShowSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    category: { type: String, enum: CATEGORIES, default: 'enseignement' },
    coverUrl: { type: String, trim: true },
    coverPublicId: { type: String, trim: true, select: false },
    isPublished: { type: Boolean, default: true },
    label: { type: String, trim: true },
  },
  { timestamps: true },
);

PodcastShowSchema.index({ isPublished: 1, category: 1 });
PodcastShowSchema.statics.CATEGORIES = CATEGORIES;

module.exports = PodcastShowSchema;
