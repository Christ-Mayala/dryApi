const asyncHandler = require('express-async-handler');
const { signToken } = require('../../utils/auth/jwt.util');
const crypto = require('crypto');
const sendResponse = require('../../utils/http/response');
const emailService = require('../../services/auth/email.service');
const EmailTemplates = require('../../config/templates/email.templates');

// GÃ©nÃ©ration Token
const generateToken = (id) => {
    return signToken(id);
};

// --- LOGIN ---
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const User = req.getModel('User'); // ModÃ¨le Dynamique

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user) {
        // Anti-timing attack
        await new Promise(resolve => setTimeout(resolve, 500)); 
        throw new Error('Identifiants invalides');
    }

    // VÃ©rif Verrouillage (sauf pour admin)
    if (user.role !== 'admin' && user.lockUntil && user.lockUntil > Date.now()) {
        throw new Error('Compte temporairement verrouillÃ©. Trop de tentatives.');
    }

    // VÃ©rif Password
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
    
    // Nettoyage user pour rÃ©ponse
    const userData = user.toObject();
    delete userData.password;
    delete userData.lockUntil;
    delete userData.loginAttempts;

    sendResponse(res, { token, user: userData }, 'Connexion rÃ©ussie');
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
    if (userExists) throw new Error('Cet email est dÃ©jÃ  utilisÃ©');

    const user = await User.create(payload);

    const shouldSend = (process.env.SEND_WELCOME_EMAIL_ON_REGISTER || 'true') === 'true';
    if (shouldSend && user?.email) {
        Promise.resolve(
            emailService.sendGenericEmail({
                email: user.email,
                subject: 'Bienvenue sur La STREET',
                html: EmailTemplates.WELCOME_REGISTER(user.name || ''),
            })
        ).catch(() => {});
    }

    sendResponse(res, user, 'Inscription rÃ©ussie');
});

// --- GET ME (Profil) --- 
exports.getMe = asyncHandler(async (req, res) => {
    sendResponse(res, req.user, 'Profil utilisateur');
});

// --- UPDATE ME ---
exports.updateMe = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new Error('Non autorisÃ©');

    const User = req.getModel('User');

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) updates.name = String(body.name || '').trim();
    if (body.nom !== undefined) updates.nom = String(body.nom || '').trim();
    if (body.telephone !== undefined) updates.telephone = String(body.telephone || '').trim();

    if (req.file) {
        const url = req.file?.path || req.file?.secure_url || req.file?.url || '';
        const publicId = req.file?.filename || req.file?.public_id || '';
        if (url) updates.avatarUrl = url;
        if (publicId) updates.avatarPublicId = publicId;
    }

    const updated = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) throw new Error('Utilisateur introuvable');

    const userData = updated.toObject();
    delete userData.password;
    delete userData.lockUntil;
    delete userData.loginAttempts;

    sendResponse(res, userData, 'Profil mis Ã  jour');
});

// --- REQUEST PASSWORD RESET ---
exports.requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const User = req.getModel('User');

    const user = await User.findOne({ email });
    if (!user) {
        // Anti-timing attack - ne pas rÃ©vÃ©ler si l'email existe
        return sendResponse(res, { message: 'Si cet email existe, un code de rÃ©initialisation a Ã©tÃ© envoyÃ©' }, 'Code envoyÃ©');
    }

    // GÃ©nÃ©rer code de 6 chiffres
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    await User.findByIdAndUpdate(user._id, {
        resetCode,
        resetCodeExpires,
        passwordChangedAt: undefined // Marquer l'ancien mot de passe comme invalide
    });

    // Envoyer email
    try {
        await emailService.sendGenericEmail({
            email: user.email,
            subject: 'Code de rÃ©initialisation - La STREET',
            html: emailService.generatePasswordResetTemplate(resetCode, req.appName || 'user'),
        });
    } catch (emailError) {
        console.error('Erreur envoi email reset:', emailError);
        // Continuer mÃªme si l'email Ã©choue en dev
    }

    sendResponse(res, { message: 'Si cet email existe, un code de rÃ©initialisation a Ã©tÃ© envoyÃ©' }, 'Code envoyÃ©');
});

// --- VERIFY RESET CODE ---
exports.verifyResetCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const User = req.getModel('User');

    const user = await User.findOne({ 
        email,
        resetCode: code,
        resetCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new Error('Code invalide ou expirÃ©');
    }

    sendResponse(res, { valid: true }, 'Code valide');
});

// --- RESET PASSWORD ---
exports.resetPassword = asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const User = req.getModel('User');

    const user = await User.findOne({ 
        email,
        resetCode: code,
        resetCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new Error('Code invalide ou expirÃ©');
    }

    // Mettre Ã  jour le mot de passe
    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Envoyer email de confirmation
    try {
        await emailService.sendGenericEmail({
            email: user.email,
            subject: 'Mot de passe rÃ©initialisÃ© - La STREET',
            html: emailService.generatePasswordResetConfirmationTemplate(req.appName || 'user'),
        });
    } catch (emailError) {
        console.error('Erreur envoi email confirmation:', emailError);
    }

    sendResponse(res, { message: 'Mot de passe rÃ©initialisÃ© avec succÃ¨s' }, 'SuccÃ¨s');
});

