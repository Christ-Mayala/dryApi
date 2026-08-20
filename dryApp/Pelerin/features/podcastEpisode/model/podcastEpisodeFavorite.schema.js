const mongoose = require('mongoose');

// Episode favori d'un utilisateur. Donnee strictement personnelle.
const PodcastEpisodeFavoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    episodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastEpisode', required: true },
  },
  { timestamps: true },
);

PodcastEpisodeFavoriteSchema.index({ userId: 1, episodeId: 1 }, { unique: true });
PodcastEpisodeFavoriteSchema.index({ userId: 1, createdAt: -1 });

module.exports = PodcastEpisodeFavoriteSchema;
