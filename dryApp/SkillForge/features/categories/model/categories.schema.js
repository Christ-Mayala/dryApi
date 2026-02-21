const mongoose = require('mongoose');

const CategoriesSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  icon: { type: String, required: true, trim: true },
  parentId: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes pour performance et requetes frequentes
CategoriesSchema.index({ createdAt: -1 });
CategoriesSchema.index({ status: 1 });

// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global

module.exports = CategoriesSchema;
