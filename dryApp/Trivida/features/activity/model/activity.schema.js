const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    localId: { type: Number },
    
    name: { type: String, required: true },
    type: { type: String, required: true }, // commerce, service, production, etc.
    manager: { type: String },
    description: { type: String },
    
    // Métadonnées flexibles (JSON)
    metadata: { type: mongoose.Schema.Types.Mixed },
    
    // Soft delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
}, {
    timestamps: true,
    versionKey: false,
});

// Index composés
ActivitySchema.index({ userId: 1, name: 1 });
ActivitySchema.index({ userId: 1, type: 1 });

// Exclure les activités supprimées
ActivitySchema.pre(/^find/, function() {
    this.where({ deleted: { $ne: true } });
});

module.exports = ActivitySchema;
