const mongoose = require('mongoose');

const ImpactSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Titre de l'action (Source slug)
    description: { type: String, required: true },
    images: [{ type: String }],
    videos: [{ type: String }],
    date: { type: Date, default: Date.now },
    location: { type: String }
}, { timestamps: true });

module.exports = ImpactSchema;