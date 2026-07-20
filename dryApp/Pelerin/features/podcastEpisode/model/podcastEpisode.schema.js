const mongoose = require('mongoose');

// Un episode appartenant a une emission (PodcastShow), organise par
// saison/numero. L'audio est heberge sur Cloudinary (jamais de fichier sur le
// serveur applicatif) via dryApp/Pelerin/services/upload.service.js.
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
    tags: { type: [String], default: [] },
    publishDate: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true },
    label: { type: String, trim: true },
  },
  { timestamps: true },
);

PodcastEpisodeSchema.index({ showId: 1, season: 1, episodeNumber: 1 });
PodcastEpisodeSchema.index({ isPublished: 1, publishDate: -1 });

module.exports = PodcastEpisodeSchema;
