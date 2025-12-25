const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Le nom est obligatoire'] }, // Source du Slug
    category: { 
        type: String, 
        required: true,
        enum: ['sac', 'trousse', 'sandale', 'accessoire', 'personnalise', 'saisonnier'] 
    },
    price: { type: Number, required: true },
    description: { type: String },
    images: [{ type: String }], // Liste des URLs Cloudinary
    isFeatured: { type: Boolean, default: false }, // "A la une"
    inStock: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = ProductSchema;