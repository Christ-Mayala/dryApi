const mongoose = require('mongoose');

/**
 * Source YouTube pour les Prédications de la Maison.
 * Chaque source représente une chaîne ou une playlist YouTube à synchroniser.
 */
const HousePreachingSourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['youtube'], default: 'youtube' },
    channelId: { type: String, trim: true },
    channelHandle: { type: String, trim: true },
    channelUrl: { type: String, trim: true },
    playlistId: { type: String, trim: true },
    category: { type: String, trim: true, default: 'predication' },
    preacher: { type: String, trim: true, default: 'Pasteur Yves Castanou' },
    autoPublish: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastSyncAt: { type: Date, default: null },
    syncStatus: { type: String, enum: ['never', 'ok', 'error'], default: 'never' },
    syncError: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

HousePreachingSourceSchema.index({ platform: 1, isActive: 1 });
HousePreachingSourceSchema.index({ channelHandle: 1 });

module.exports = HousePreachingSourceSchema;
