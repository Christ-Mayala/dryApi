const mongoose = require('mongoose');

// Historique / progression d'ecoute d'un utilisateur. Un document par
// (userId, episodeId) : la progression est ecrasee (reprise multi-appareils),
// `completed` signale une ecoute terminee. Donnee strictement personnelle.
const PodcastListenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastShow', required: true },
    episodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastEpisode', required: true },
    positionMs: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastPlayedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

PodcastListenSchema.index({ userId: 1, episodeId: 1 }, { unique: true });
PodcastListenSchema.index({ userId: 1, lastPlayedAt: -1 });

module.exports = PodcastListenSchema;
