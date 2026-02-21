const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
    {
        expediteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        destinataire: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        sujet: { type: String, trim: true, default: '' },
        contenu: { type: String, required: true },
        lu: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false },
);

// Optimise inbox, unread count and thread queries.
MessageSchema.index({ expediteur: 1, destinataire: 1, createdAt: -1 });
MessageSchema.index({ destinataire: 1, expediteur: 1, createdAt: -1 });
MessageSchema.index({ destinataire: 1, lu: 1, createdAt: -1 });

module.exports = MessageSchema;
