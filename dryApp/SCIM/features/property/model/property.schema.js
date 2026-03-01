const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema(
    {
        titre: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        prix: { type: Number, required: true },
        ville: { type: String, trim: true },
        adresse: { type: String, trim: true },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        transactionType: {
            type: String,
            enum: ['location', 'vente'],
            default: 'location',
            index: true,
        },
        categorie: {
            type: String,
            enum: ['Appartement', 'Maison', 'Hôtel', 'Terrain', 'Commercial', 'Autre'],
            default: 'Autre',
            index: true,
        },
        isBonPlan: { type: Boolean, default: false, index: true },
        bonPlanLabel: { type: String, trim: true },
        bonPlanExpiresAt: { type: Date },

        prixOriginal: { type: Number },
        devise: { type: String, default: 'XAF', trim: true },
        images: [{
            url: { type: String, required: true },
            public_id: { type: String, required: true },
        }],
        evaluations: [
            {
                utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                note: { type: Number, required: true },
                creeLe: { type: Date, default: Date.now },
            },
        ],
        noteMoyenne: { type: Number, default: 0 },
        nombreAvis: { type: Number, default: 0 },
        vues: { type: Number, default: 0 },
        utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        favoris: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date },

        nombre_chambres: { type: Number, default: 1, min: 0 },
        nombre_salles_bain: { type: Number, default: 1, min: 0 },
        nombre_salons: { type: Number, default: 1, min: 0 },
        superficie: { type: Number, min: 0 },
        garage: { type: Boolean, default: false },
        gardien: { type: Boolean, default: false },
        balcon: { type: Boolean, default: false },
        piscine: { type: Boolean, default: false },
        jardin: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false },
);

module.exports = PropertySchema;
