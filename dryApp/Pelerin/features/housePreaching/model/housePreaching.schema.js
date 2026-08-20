const mongoose = require('mongoose');

const CATEGORIES = [
  'predication',
  'enseignement',
  'temoignage',
  'louange',
  'autre',
];

const HousePreachingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    preacher: { type: String, trim: true, default: 'Pasteur Yves Castanou' },
    category: { type: String, enum: CATEGORIES, default: 'predication' },
    coverUrl: { type: String, trim: true },
    youtubeVideoId: { type: String, trim: true, required: true },
    youtubeUrl: { type: String, trim: true },
    duration: { type: String, trim: true },
    publishedAt: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
    syncStatus: { type: String, enum: ['never', 'ok', 'error'], default: 'never' },
    syncError: { type: String, trim: true, default: null },
    // Source d'origine (chaîne YouTube)
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'HousePreachingSource', default: null },
    sourceName: { type: String, trim: true, default: null },
    channelHandle: { type: String, trim: true, default: null },
    // Statut de diffusion (filtre « En direct / Passé ») : live = actuellement
    // en direct au moment de la sync, upcoming = programmé, none = passé.
    liveBroadcast: { type: String, enum: ['live', 'upcoming', 'none'], default: 'none' },
  },
  { timestamps: true }
);

HousePreachingSchema.index({ isPublished: 1, publishedAt: -1 });
HousePreachingSchema.index({ youtubeVideoId: 1 }, { unique: true });
HousePreachingSchema.index({ isActive: 1 });
HousePreachingSchema.index({ sourceId: 1 });
HousePreachingSchema.statics.CATEGORIES = CATEGORIES;

module.exports = HousePreachingSchema;
