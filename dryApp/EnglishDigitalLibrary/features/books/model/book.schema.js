const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  authors: { type: [String], required: true, validate: v => v.length > 0 },
  description: { type: String, default: '', maxlength: 5000 },
  language: { type: String, default: 'English', enum: ['English'] },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  categoryPath: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true }],
  tags: { type: [String], default: [] },
  publisher: { type: String, default: '', maxlength: 160 },
  publicationYear: { type: Number, min: 1000, max: new Date().getFullYear() + 1 },
  isbn: { type: String, default: '', maxlength: 20 },
  pageCount: { type: Number, min: 1 },
  readingLevel: { type: String, enum: ['', 'Beginner', 'Intermediate', 'Advanced', 'Academic'], default: '' },
  coverUrl: { type: String, default: '' },
  coverPublicId: { type: String, default: '' },
  documentPublicId: { type: String, default: '' },
  documentUrl: { type: String, default: '' },
  // Legacy PDFs default to Cloudinary; new uploads explicitly use shared R2 storage.
  documentStorageProvider: { type: String, enum: ['cloudinary', 'r2'], default: 'cloudinary' },
  // Les livres hébergés par Project Gutenberg gardent leur texte chez la source officielle.
  externalReadUrl: {
    type: String,
    default: '',
    maxlength: 500,
    validate: {
      validator: value => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && url.hostname === 'www.gutenberg.org' && /^\/ebooks\/\d+\/?$/.test(url.pathname);
        } catch (_) { return false; }
      },
      message: 'External reading links must point to a Project Gutenberg ebook page.',
    },
  },
  documentBytes: { type: Number, default: 0 },
  languageValidationStatus: { type: String, enum: ['Pending', 'Valid', 'Invalid', 'Manual Review'], default: 'Pending', index: true },
  languageValidationNote: { type: String, default: '' },
  detectedLanguage: { type: String, default: '' },
  languageConfidence: { type: Number, min: 0, max: 1 },
  visibility: { type: String, enum: ['public', 'registered', 'staff'], default: 'public' },
  downloadAllowed: { type: Boolean, default: false },
  license: { type: String, default: '' },
  rightsStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  source: { type: String, default: '' },
  status: { type: String, enum: ['Draft', 'Pending Validation', 'Published', 'Rejected', 'Archived'], default: 'Draft', index: true },
  viewsCount: { type: Number, default: 0 },
  downloadsCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date },
}, { timestamps: true, versionKey: false });

BookSchema.index({ title: 'text', authors: 'text', tags: 'text', description: 'text', publisher: 'text', isbn: 'text' }, { weights: { title: 10, authors: 6, tags: 4, isbn: 8, publisher: 2, description: 1 }, name: 'library_book_text' });
BookSchema.index({ status: 1, publishedAt: -1 });
BookSchema.pre('validate', function () {
  if (this.status === 'Published' && (this.languageValidationStatus !== 'Valid' || this.rightsStatus !== 'approved' || (!this.documentPublicId && !this.externalReadUrl))) {
    this.invalidate('status', 'A book requires English validation, approved distribution rights, and a stored PDF or approved reading source before publication.');
  }
});

module.exports = BookSchema;
