const mongoose = require('mongoose');

/**
 * Token push d'un appareil pour les notifications.
 * Un utilisateur peut avoir plusieurs appareils.
 */
const PushTokenSchema = new mongoose.Schema(
  {
    createdBy: { type: String, required: true, trim: true },
    pushToken: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  },
  { timestamps: true },
);

PushTokenSchema.index({ createdBy: 1, pushToken: 1 }, { unique: true });

/**
 * Préférences de notifications d'un utilisateur.
 * Un document par utilisateur.
 */
const NotificationPreferencesSchema = new mongoose.Schema(
  {
    createdBy: { type: String, required: true, trim: true },
    dailyMeditation: { type: Boolean, default: true },
    dailyHabit: { type: Boolean, default: true },
    dailyVerse: { type: Boolean, default: false },
    newTemoignage: { type: Boolean, default: true },
    newParcours: { type: Boolean, default: true },
    meditationTime: { type: String, default: '07:00' },
    habitTime: { type: String, default: '08:00' },
    verseTime: { type: String, default: '06:30' },
  },
  { timestamps: true },
);

NotificationPreferencesSchema.index({ createdBy: 1 }, { unique: true });

module.exports = { PushTokenSchema, NotificationPreferencesSchema };
