const mongoose = require('mongoose');

// Catégories initiales (produit) + catégories historiques conservées pour la
// compatibilité avec les émissions existantes.
const CATEGORIES = [
  'foi-spiritualite',
  'enseignement',
  'vie-chretienne',
  'temoignage',
  'jeunesse',
  'dev-personnel',
  'priere',
  'famille',
  'leadership',
  'etude-biblique',
  'actualite',
  'louange',
  'autre',
];

// Une emission de podcast (regroupe des episodes par saison). Contenu
// editorial : lecture publique, ecriture admin (upload de couverture via
// dryApp/Pelerin/services/upload.service.js). Les podcasts externes importes
// via RSS sont identifies par `rssUrl` (jamais de re-hebergement de l'audio :
// on conserve les metadonnees + les URLs d'origine).
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

    // --- Pipeline d'import automatique (découverte Podcast Index) ---
    // manual   = import explicite par l'admin (toujours publié) ;
    // auto     = publié automatiquement (score ≥ 80) ;
    // pending  = en attente de validation admin (score 50–79) ;
    // rejected = rejeté automatiquement (score < 50) ou par l'admin.
    autoPublishStatus: { type: String, enum: ['manual', 'auto', 'pending', 'rejected'], default: 'manual' },
    score: { type: Number, default: null },
    scoreBreakdown: { type: Array, default: [] },
    // Motif de modération admin (rejet / désactivation), optionnel.
    moderationReason: { type: String, trim: true, default: null },

    // --- Podcast externe (import RSS) ---
    rssUrl: { type: String, trim: true },
    websiteUrl: { type: String, trim: true },
    language: { type: String, trim: true, default: 'fr' },
    isFeatured: { type: Boolean, default: false },

    // --- État de synchronisation RSS ---
    lastSyncedAt: { type: Date, default: null },
    syncStatus: { type: String, enum: ['never', 'ok', 'error'], default: 'never' },
    syncError: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

PodcastShowSchema.index({ isPublished: 1, category: 1 });
PodcastShowSchema.index({ rssUrl: 1 });
PodcastShowSchema.index({ isFeatured: 1, createdAt: -1 });
PodcastShowSchema.index({ autoPublishStatus: 1 });
PodcastShowSchema.statics.CATEGORIES = CATEGORIES;

module.exports = PodcastShowSchema;
