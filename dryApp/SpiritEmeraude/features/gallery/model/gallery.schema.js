const mongoose = require('mongoose');
const GallerySchema = new mongoose.Schema({
    name: { type: String, default: 'Photo' }, // Titre optionnel (Source slug)
    category: { type: String, enum: ['atelier', 'creation', 'humanitaire', 'autre'], default: 'autre' },
    imageUrl: { type: String, required: true }
}, { timestamps: true });
module.exports = GallerySchema;