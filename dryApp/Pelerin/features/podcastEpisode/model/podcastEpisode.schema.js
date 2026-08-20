const mongoose = require('mongoose');

// Un episode appartenant a une emission (PodcastShow), organise par
// saison/numero. L'audio est heberge sur Cloudinary (jamais de fichier sur le
// serveur applicatif) via dryApp/Pelerin/services/upload.service.js, OU
// reference l'URL audio originale pour les podcasts externes (import RSS) —
// jamais de re-hebergement.
const PodcastEpisodeSchema = new mongoose.Schema(
  {
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastShow', required: true },
    season: { type: Number, default: 1, min: 1 },
    episodeNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    audioUrl: { type: String, required: true, trim: true },
    audioPublicId: { type: String, trim: true, select: false },
    coverUrl: { type: String, trim: true }, // optionnel, sinon fallback sur la couverture de l'emission
    duration: { type: String, trim: true }, // ex: "32:10", affiche tel quel
    // Taille du fichier audio en octets (enclosure length du flux RSS) —
    // affichée dans l'écran Téléchargements (indicateur par épisode).
    sizeBytes: { type: Number, default: null },
    tags: { type: [String], default: [] },
    publishDate: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true },
    label: { type: String, trim: true },

    // --- Podcast externe (RSS) ---
    guid: { type: String, trim: true }, // identifiant stable du flux (deduplication)
    playCount: { type: Number, default: 0 }, // popularite (incremente a chaque ecoute)
  },
  { timestamps: true },
);

PodcastEpisodeSchema.index({ showId: 1, season: 1, episodeNumber: 1 });
PodcastEpisodeSchema.index({ isPublished: 1, publishDate: -1 });
PodcastEpisodeSchema.index({ guid: 1 });
PodcastEpisodeSchema.index({ showId: 1, guid: 1 }, { unique: true, sparse: true });

module.exports = PodcastEpisodeSchema;
