const mongoose = require('mongoose');

const FormationSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Titre de la formation (Source slug)
    description: { type: String, required: true },
    duration: { type: String }, // ex: "3 semaines"
    price: { type: Number },
    materials: { type: String }, // Liste matériel
    image: { type: String },
    nextSession: { type: Date }
}, { timestamps: true });

module.exports = FormationSchema;