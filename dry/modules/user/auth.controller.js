const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const sendResponse = require('../../utils/response');
const sendEmail = require('../../services/email/email.service');
const EmailTemplates = require('../../config/templates/email.templates');

// Génération Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// --- LOGIN ---
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const User = req.getModel('User'); // Modèle Dynamique

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user) {
        // Anti-timing attack
        await new Promise(resolve => setTimeout(resolve, 500)); 
        throw new Error('Identifiants invalides');
    }

    // Vérif Verrouillage (sauf pour admin)
    if (user.role !== 'admin' && user.lockUntil && user.lockUntil > Date.now()) {
        throw new Error('Compte temporairement verrouillé. Trop de tentatives.');
    }

    // Vérif Password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        if (user.role !== 'admin') {
            await user.incLoginAttempts();
        }
        throw new Error('Identifiants invalides');
    }

    // Reset tentatives
    await user.constructor.updateOne(
        { _id: user._id },
        { $set: { loginAttempts: 0, lastLogin: Date.now(), lastIp: req.ip }, $unset: { lockUntil: 1 } }
    );

    const token = generateToken(user._id);
    
    // Nettoyage user pour réponse
    const userData = user.toObject();
    delete userData.password;
    delete userData.lockUntil;
    delete userData.loginAttempts;

    sendResponse(res, { token, user: userData }, 'Connexion réussie');
});

// --- REGISTER ---
exports.register = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const payload = { ...req.body };

    if (!payload.name && payload.nom) {
        payload.name = payload.nom;
    }
    if (!payload.nom && payload.name) {
        payload.nom = payload.name;
    }

    const userExists = await User.findOne({ email: payload.email });
    if (userExists) throw new Error('Cet email est déjà utilisé');

    const user = await User.create(payload);

    const shouldSend = (process.env.SEND_WELCOME_EMAIL_ON_REGISTER || 'true') === 'true';
    if (shouldSend && user?.email) {
        Promise.resolve(
            sendEmail({
                email: user.email,
                subject: 'Bienvenue sur La STREET',
                html: EmailTemplates.WELCOME_REGISTER(user.name || ''),
            })
        ).catch(() => {});
    }

    sendResponse(res, user, 'Inscription réussie');
});

// --- GET ME (Profil) --- 
exports.getMe = asyncHandler(async (req, res) => {
    sendResponse(res, req.user, 'Profil utilisateur');
});

// --- UPDATE ME ---
exports.updateMe = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new Error('Non autorisé');

    const User = req.getModel('User');

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) updates.name = String(body.name || '').trim();
    if (body.nom !== undefined) updates.nom = String(body.nom || '').trim();
    if (body.telephone !== undefined) updates.telephone = String(body.telephone || '').trim();

    const updated = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) throw new Error('Utilisateur introuvable');

    sendResponse(res, updated, 'Profil mis à jour');
});