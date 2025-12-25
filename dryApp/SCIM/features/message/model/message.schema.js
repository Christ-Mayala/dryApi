const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
    {
        expediteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        destinataire: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        contenu: { type: String, required: true },
        lu: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false },
);

module.exports = MessageSchema;
