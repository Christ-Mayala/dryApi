const mongoose = require('mongoose');

/**
 * Notification reçue par un utilisateur (inbox).
 *
 * Générée par des événements réels du backend (ex. : témoignage approuvé,
 * nouvelle prédication publiée…) via le service notifications.service.js.
 * L'envoi push est découplé : ce modèle est la source de vérité de l'inbox,
 * consultée par l'app (GET /notifications). Chaque utilisateur ne voit que
 * ses propres notifications.
 */
const NotificationSchema = new mongoose.Schema(
  {
    createdBy: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    type: {
      type: String,
      enum: ['verse', 'habit', 'parcours', 'temoignage', 'preaching', 'system'],
      default: 'system',
    },
    // Cible de navigation quand l'utilisateur tape la notification
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ createdBy: 1, read: 1, createdAt: -1 });

module.exports = NotificationSchema;
