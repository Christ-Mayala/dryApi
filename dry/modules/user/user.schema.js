const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nom: { type: String, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'user' },

    telephone: { type: String, trim: true },

    avatar: { type: String },
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },

    favoris: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    visited: [
        {
            property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
            lastVisitedAt: { type: Date, default: Date.now },
            count: { type: Number, default: 1, min: 1 },
        },
    ],

    refreshTokens: { type: [String], default: [], select: false },
    resetCode: { type: String, select: false, default: null },
    resetCodeExpires: { type: Date, select: false, default: null },

    deleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, select: false },

    // --- SÉCURITÉ AVANCÉE ---
    loginAttempts: { type: Number, required: true, default: 0 },
    lockUntil: { type: Number },
    lastLogin: { type: Date },
    lastIp: { type: String },

    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted', 'banned'],
        default: 'active',
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.refreshTokens;
            delete ret.resetCode;
            delete ret.resetCodeExpires;
            delete ret.deleted;
            delete ret.deletedAt;
            delete ret.loginAttempts;
            delete ret.lockUntil;
            return ret;
        },
    },
});

// --- MIDDLEWARES (CORRIGÉ) ---

UserSchema.pre(/^find/, function() {
    this.where({ deleted: { $ne: true }, status: { $ne: 'deleted' } });
});

// Hashage du mot de passe avant sauvegarde
// NOTE : On utilise 'async function()' SANS 'next'
UserSchema.pre('save', async function() {
    // Si le mot de passe n'a pas changé, on ne fait rien
    if (!this.isModified('password')) return;

    // Salt de 12 pour la robustesse
    const salt = await bcrypt.genSalt(12); 
    this.password = await bcrypt.hash(this.password, salt);
    // Pas besoin d'appeler next(), la fin de la fonction async suffit
});

// --- MÉTHODES D'INSTANCE ---

// Vérifier le mot de passe
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Gestion des tentatives ratées
UserSchema.methods.incLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.constructor.updateOne(
            { _id: this._id },
            { $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } }
        );
    }

    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockHours = parseInt(process.env.LOCK_TIME) || 2;

    if (this.loginAttempts + 1 >= maxAttempts) {
        updates.$set = { lockUntil: Date.now() + (lockHours * 60 * 60 * 1000) };
    }

    return this.constructor.updateOne({ _id: this._id }, updates);
};

module.exports = UserSchema;