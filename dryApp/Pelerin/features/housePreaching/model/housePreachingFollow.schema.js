const mongoose = require('mongoose');

// Suivi d'un prêcheur par un utilisateur (bouton « Suivre » des prédications).
// Donnée strictement personnelle, liée au compte — sert à synchroniser les
// suivis entre les appareils (l'app garde une copie locale en cache hors-ligne
// mais la source de vérité est ici).
const HousePreachingFollowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    preacher: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

HousePreachingFollowSchema.index({ userId: 1, preacher: 1 }, { unique: true });
HousePreachingFollowSchema.index({ userId: 1, createdAt: -1 });

module.exports = HousePreachingFollowSchema;
