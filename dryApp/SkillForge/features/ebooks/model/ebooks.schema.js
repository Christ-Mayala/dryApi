const mongoose = require('mongoose');

const EbooksSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  summary: { type: String, required: true, trim: true },
  pages: { type: Number, required: true },
  format: { type: String, required: true, trim: true },
  coverUrl: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
EbooksSchema.index({ createdAt: -1 });
EbooksSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = EbooksSchema;
