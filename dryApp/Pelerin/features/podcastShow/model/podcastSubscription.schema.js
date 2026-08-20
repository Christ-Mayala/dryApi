const mongoose = require('mongoose');

// Abonnement d'un utilisateur a une emission (bouton "Suivre"). Donnee
// strictement personnelle, liee au compte (isolation inter-comptes cote app).
const PodcastSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastShow', required: true },
  },
  { timestamps: true },
);

PodcastSubscriptionSchema.index({ userId: 1, showId: 1 }, { unique: true });
PodcastSubscriptionSchema.index({ userId: 1, createdAt: -1 });

module.exports = PodcastSubscriptionSchema;
