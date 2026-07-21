const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../../../../../config/database');

const TrividaUserSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Un nom est obligatoire'] },
    email: { type: String, required: [true, 'Un email est obligatoire'], unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    telephone: { type: String, trim: true },
    
    // Avatar
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },
    
    // Premium & Licensing (pour la Phase 4)
    isPremium: { type: Boolean, default: false },
    premiumUntil: { type: Date },
    premiumPlan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    
    // Préférences Trivida
    preferences: {
        currency: { type: String, default: 'XAF' },
        language: { type: String, default: 'fr' },
        notifications: { type: Boolean, default: true },
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    },
    
    // Tokens & Sécurité
    refreshTokens: { type: [String], default: [], select: false },
    resetCode: { type: String, select: false, default: null },
    resetCodeExpires: { type: Date, select: false, default: null },
    
    // Quota IA quotidien (5 requêtes/jour avec la clé globale)
    // Remis à 0 chaque minuit via aiRequestsResetAt
    aiRequestsToday: { type: Number, default: 0 },
    aiRequestsResetAt: { type: Date, default: null },

    // Profil Intel — compagnon de vie intelligent (Trivida Intel V1)
    intelProfile: {
        mainGoal: { type: String, enum: ['maison', 'voiture', 'voyage', 'entreprise', 'emploi', 'etudes', 'general'], default: null },
        blockers: { type: [String], default: [] },
        monthlyTargetAmount: { type: Number, default: 0 },
        habits: { type: [String], default: [] },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
    },
    
    // Sécurité avancée
    loginAttempts: { type: Number, required: true, default: 0 },
    lockUntil: { type: Number },
    lastLogin: { type: Date },
    lastIp: { type: String },
    passwordChangedAt: { type: Date },
    
    // Soft delete
    status: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
    deleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, select: false },
    
    // Métadonnées de synchronisation
    lastSyncAt: { type: Date },
    deviceIds: { type: [String], default: [] }, // Pour le multi-device
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

// --- MIDDLEWARES ---

// Exclure les utilisateurs supprimés
TrividaUserSchema.pre(/^find/, function() {
    const q = this.getQuery() || {};
    if (q.includeDeleted === true) {
        delete q.includeDeleted;
        return;
    }
    if (q.status === 'deleted') return;
    this.where({ status: { $ne: 'deleted' }, deleted: { $ne: true } });
});

// Hashage du mot de passe avant sauvegarde
TrividaUserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Synchroniser deleted et status
TrividaUserSchema.pre('save', function() {
    if (this.isModified('status') && this.status === 'deleted') {
        this.deleted = true;
        this.deletedAt = new Date();
    }
    if (this.isModified('status') && this.status !== 'deleted' && this.deleted === true) {
        this.deleted = false;
        this.deletedAt = null;
    }
    if (this.isModified('deleted') && this.deleted === true) {
        this.status = 'deleted';
        this.deletedAt = new Date();
    }
    if (this.isModified('deleted') && this.deleted === false && this.status === 'deleted') {
        this.status = 'active';
        this.deletedAt = null;
    }
});

// --- MÉTHODES D'INSTANCE ---

TrividaUserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

TrividaUserSchema.methods.softDelete = async function() {
    this.status = 'deleted';
    this.deleted = true;
    this.deletedAt = new Date();
    return await this.save();
};

TrividaUserSchema.methods.restore = async function() {
    this.status = 'active';
    this.deleted = false;
    this.deletedAt = null;
    return await this.save();
};

TrividaUserSchema.methods.incLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.constructor.updateOne(
            { _id: this._id },
            { $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } }
        );
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = parseInt(config.MAX_LOGIN_ATTEMPTS) || 5;
    const lockHours = parseInt(config.LOCK_TIME) || 2;
    
    if (this.loginAttempts + 1 >= maxAttempts) {
        updates.$set = { lockUntil: Date.now() + (lockHours * 60 * 60 * 1000) };
    }
    
    return this.constructor.updateOne({ _id: this._id }, updates);
};

module.exports = TrividaUserSchema;
