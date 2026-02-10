const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true, 
        enum: ['create', 'update', 'delete', 'soft-delete', 'restore'] 
    },
    collectionName: { type: String, required: true }, // Nom du modèle (ex: User, Product)
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID de l'objet modifié
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Qui a fait l'action
    changes: { type: mongoose.Schema.Types.Mixed }, // Détail des modifications (avant/après ou diff)
    metadata: { type: mongoose.Schema.Types.Mixed }, // Infos supp (IP, UserAgent...)
}, { 
    timestamps: true,
    versionKey: false 
});

// Index pour recherche rapide par collection ou par document
LogSchema.index({ collectionName: 1, documentId: 1 });
LogSchema.index({ user: 1 });
LogSchema.index({ createdAt: -1 });

module.exports = LogSchema;
