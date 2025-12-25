const mongoose = require('mongoose');

const PropertyViewSchema = new mongoose.Schema(
    {
        property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
        ipHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true, versionKey: false },
);

PropertyViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PropertyViewSchema.index({ property: 1, ipHash: 1 }, { unique: true });

module.exports = PropertyViewSchema;
