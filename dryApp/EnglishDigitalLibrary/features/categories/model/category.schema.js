const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 3000 },
  // Le fichier vit dans Cloudinary ; Mongo conserve son identifiant public, son URL et sa provenance.
  imageStorageKey: { type: String, default: '' },
  imageStorageProvider: { type: String, enum: ['', 'r2', 'cloudinary', 'legacy-mongodb'], default: '' },
  imageStorageUrl: { type: String, default: '' },
  imageAttribution: { type: String, default: '', maxlength: 500 },
  imageLicense: { type: String, default: '', maxlength: 120 },
  imageLicenseUrl: { type: String, default: '', maxlength: 1000 },
  imageSourceUrl: { type: String, default: '', maxlength: 1000 },
  // Champs de transition pour les anciennes images intégrées dans MongoDB.
  imageData: { type: String, default: '', maxlength: 750000 },
  imageContentType: { type: String, enum: ['', 'image/jpeg', 'image/png', 'image/webp'], default: '' },
  imageAlt: { type: String, default: '', maxlength: 160 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

CategorySchema.index({ parentId: 1, name: 1 }, { unique: true });
module.exports = CategorySchema;
