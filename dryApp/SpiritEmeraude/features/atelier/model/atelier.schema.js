const mongoose = require('mongoose');

const AtelierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: String },
    images: [{ type: String }],
    videos: [{ type: String }],
    nextSession: { type: Date }
}, { timestamps: true });

module.exports = AtelierSchema;
