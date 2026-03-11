const mongoose = require('mongoose');

const PropertySubmissionSchema = new mongoose.Schema(
    {
        submitter: {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            nomComplet: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true, lowercase: true },
            telephone: { type: String, required: true, trim: true },
        },
        propertyDraft: {
            titre: { type: String, required: true, trim: true },
            description: { type: String, required: true, trim: true },
            prix: { type: Number, required: true },
            ville: { type: String, required: true, trim: true },
            adresse: { type: String, required: true, trim: true },
            transactionType: {
                type: String,
                enum: ['location', 'vente'],
                required: true,
            },
            categorie: {
                type: String,
                enum: ['Appartement', 'Maison', 'Hotel', 'Hôtel', 'Terrain', 'Commercial', 'Autre'],
                default: 'Autre',
            },
            superficie: { type: Number },
            nombre_chambres: { type: Number, default: 0 },
            nombre_salles_bain: { type: Number, default: 0 },
            nombre_salons: { type: Number, default: 0 },
            garage: { type: Boolean, default: false },
            gardien: { type: Boolean, default: false },
            balcon: { type: Boolean, default: false },
            piscine: { type: Boolean, default: false },
            jardin: { type: Boolean, default: false },
            images: [
                {
                    url: { type: String, required: true, trim: true },
                    label: { type: String, trim: true },
                },
            ],
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
        reviewNote: { type: String, trim: true },
        createdProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
        source: {
            type: String,
            enum: ['public_form', 'authenticated_form'],
            default: 'public_form',
        },
    },
    { timestamps: true, versionKey: false },
);

PropertySubmissionSchema.index({ createdAt: -1 });

module.exports = PropertySubmissionSchema;
