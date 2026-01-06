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

// --- MIDDLEWARES (CORRIGÉ POUR COHÉRENCE) ---

UserSchema.pre(/^find/, function() {
    // 🔥 CORRECTION : On filtre par status ET on synchronise avec deleted
    // Pour assurer la cohérence entre les deux systèmes
    this.where({
        $or: [
            { status: { $ne: 'deleted' } },
            { deleted: { $ne: true } }
        ]
    });
});

// Hashage du mot de passe avant sauvegarde
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// 🔥 NOUVEAU : Middleware pour synchroniser deleted et status
UserSchema.pre('save', function() {
    // Si status devient 'deleted', on met aussi deleted à true
    if (this.isModified('status') && this.status === 'deleted') {
        this.deleted = true;
        this.deletedAt = new Date();
    }

    // Si status n'est plus 'deleted', on remet deleted à false
    if (this.isModified('status') && this.status !== 'deleted' && this.deleted === true) {
        this.deleted = false;
        this.deletedAt = null;
    }

    // Si deleted devient true, on met status à 'deleted'
    if (this.isModified('deleted') && this.deleted === true) {
        this.status = 'deleted';
        this.deletedAt = new Date();
    }

    // Si deleted devient false, on remet status à 'active'
    if (this.isModified('deleted') && this.deleted === false && this.status === 'deleted') {
        this.status = 'active';
        this.deletedAt = null;
    }
});

// --- MÉTHODES D'INSTANCE ---

UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 🔥 NOUVELLE MÉTHODE : Soft delete cohérent
UserSchema.methods.softDelete = async function() {
    this.status = 'deleted';
    this.deleted = true;
    this.deletedAt = new Date();
    return await this.save();
};

// 🔥 NOUVELLE MÉTHODE : Restaurer un utilisateur
UserSchema.methods.restore = async function() {
    this.status = 'active';
    this.deleted = false;
    this.deletedAt = null;
    return await this.save();
};

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