const mongoose = require('mongoose');

// Un temoignage : avant / rencontre / apres. Peut etre soumis par un utilisateur
// (moderation admin requise, isApproved:false par defaut) ou etre le temoignage
// personnel mis en avant par l'equipe Pelerin (isFeatured, toujours pre-approuve).
const TemoignageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  authorName: { type: String, required: true, trim: true },
  authorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  before: { type: String, required: true, trim: true },
  encounter: { type: String, required: true, trim: true },
  after: { type: String, required: true, trim: true },
  images: { type: [String], default: [] },
  audioUrl: { type: String, trim: true, default: null },
  category: { type: String, trim: true },
  isApproved: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false }, // temoignage personnel mis en avant
  label: { type: String, trim: true }
}, {
  timestamps: true
});

TemoignageSchema.index({ isApproved: 1, isFeatured: -1, createdAt: -1 });

module.exports = TemoignageSchema;
