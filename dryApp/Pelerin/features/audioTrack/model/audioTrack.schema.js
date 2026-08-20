const mongoose = require('mongoose');

const CATEGORIES = ['gospel', 'louange', 'podcast', 'enseignement'];

// Un contenu audio chretien : soit un fichier uploade par l'admin (heberge
// sur Cloudinary via dryApp/Pelerin/services/upload.service.js, jamais sur le
// serveur applicatif), soit un lien externe (YouTube, Spotify, flux mp3
// direct...). Lecture publique, ecriture admin.
const AudioTrackSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: String, trim: true },
  category: { type: String, enum: CATEGORIES, required: true },
  url: { type: String, required: true, trim: true },
  audioPublicId: { type: String, trim: true, select: false }, // present seulement si upload (vs lien externe)
  coverUrl: { type: String, trim: true },
  coverPublicId: { type: String, trim: true, select: false },
  duration: { type: String, trim: true }, // ex: "3:45", format libre affiche tel quel
  label: { type: String, trim: true },
  // Source de la piste : 'upload' (fichier/lien admin) ou 'youtube' (importée
  // automatiquement par la découverte). Pour 'youtube', `url` est l'URL watch
  // YouTube et `youtubeVideoId` permet de résoudre le flux audio à la lecture.
  source: { type: String, enum: ['upload', 'youtube'], default: 'upload' },
  youtubeVideoId: { type: String, trim: true, default: null },
}, {
  timestamps: true
});

AudioTrackSchema.index({ category: 1, createdAt: -1 });
AudioTrackSchema.index({ youtubeVideoId: 1 }, { unique: true, sparse: true });
AudioTrackSchema.statics.CATEGORIES = CATEGORIES;

module.exports = AudioTrackSchema;
