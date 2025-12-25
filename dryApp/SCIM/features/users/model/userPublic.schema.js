const mongoose = require('mongoose');

const UserPublicSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        nom: { type: String, trim: true },
        email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        role: { type: String, default: 'user' },
        telephone: { type: String, trim: true },
        avatarUrl: { type: String, default: null },
        avatarPublicId: { type: String, default: null },
        refreshTokens: { type: [String], default: [], select: false },
        resetCode: { type: String, select: false, default: null },
        resetCodeExpires: { type: Date, select: false, default: null },
        deleted: { type: Boolean, default: false, select: false },
        deletedAt: { type: Date, select: false },
    },
    { timestamps: true, versionKey: false },
);

module.exports = UserPublicSchema;
