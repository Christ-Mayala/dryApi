#!/usr/bin/env node
/**
 * Seed Trivida — Crée admin + superadmin
 * Usage: cd dryApi && node scripts/seed/trivida-seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
const dbName = 'TrividaDB';

// Utilisateurs à créer
const users = [
    {
        name: process.env.SEED_SUPERADMIN_NAME || 'Super Admin Trivida',
        email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@trivida.app',
        password: process.env.SEED_SUPERADMIN_PASSWORD || 'Trivida@2026',
        telephone: '+242068457521',
        role: 'superadmin',
    },
    {
        name: process.env.SEED_ADMIN_NAME || 'Admin Trivida',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@trivida.app',
        password: process.env.SEED_ADMIN_PASSWORD || 'Trivida@2026',
        telephone: '+242060000001',
        role: 'admin',
    },
];

const log = (msg) => console.log(`[trivida-seed] ${msg}`);

const run = async () => {
    if (!MONGO_URI) {
        log('❌ MONGO_URI non défini dans .env');
        process.exit(1);
    }

    log(`Connexion à MongoDB (${dbName})...`);
    const conn = await mongoose.connect(MONGO_URI);
    log(`✅ Connecté à ${conn.connection.host}`);

    const db = conn.connection.useDb(dbName);

    // Schéma simplifié pour le seed (identique au trividaUser.schema)
    const UserSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        telephone: { type: String, trim: true },
        role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
        status: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
        isPremium: { type: Boolean, default: false },
        premiumPlan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
        preferences: {
            currency: { type: String, default: 'XAF' },
            language: { type: String, default: 'fr' },
            notifications: { type: Boolean, default: true },
            theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
        },
        loginAttempts: { type: Number, default: 0 },
        lastLogin: { type: Date },
    }, { timestamps: true, versionKey: false });

    // Hash password avant save
    UserSchema.pre('save', async function () {
        if (!this.isModified('password')) return;
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    });

    const User = db.model('User', UserSchema);

    for (const u of users) {
        const existing = await User.findOne({ email: u.email });
        if (existing) {
            // Mettre à jour le role si nécessaire
            if (existing.role !== u.role) {
                await User.updateOne({ _id: existing._id }, { $set: { role: u.role } });
                log(`✅ ${u.email} → role mis à jour: ${u.role}`);
            } else {
                log(`⏭️  ${u.email} existe déjà (role: ${u.role})`);
            }
        } else {
            // Créer avec password brut — le pre('save') va hasher
            const created = await User.create({
                name: u.name,
                email: u.email,
                password: u.password,
                telephone: u.telephone,
                role: u.role,
                status: 'active',
            });
            log(`✅ ${u.email} créé (role: ${u.role}, id: ${created._id})`);
        }
    }

    // Vérification finale
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('name email role status');
    log(`\n📋 Utilisateurs admin dans ${dbName} :`);
    for (const a of admins) {
        log(`   ${a.role.toUpperCase().padEnd(12)} ${a.email.padEnd(30)} ${a.name} (${a.status})`);
    }

    await mongoose.disconnect();
    log('✅ Déconnecté.');
};

run().catch((err) => {
    log(`❌ Erreur: ${err.message}`);
    process.exit(1);
});
