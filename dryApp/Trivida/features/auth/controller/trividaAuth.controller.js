const asyncHandler = require('express-async-handler');
const { signAccessToken, signRefreshToken, verifyToken, hashToken } = require('../../../../../dry/utils/auth/jwt.util');
const crypto = require('crypto');
const sendResponse = require('../../../../../dry/utils/http/response');
const emailService = require('../../../../../dry/services/auth/email.service');
const config = require('../../../../../config/database');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { SCHEMA_MAP } = require('../../sync/controller/sync.controller');

// --- LOGIN (réutilise le kernel) ---
exports.login = require('../../../../../dry/modules/user/auth.controller').login;

// --- REGISTER (spécifique Trivida, sans vérification SystemSettings) ---
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
    if (userExists) throw httpError('Cet email est déjà utilisé', 409);

    // Pas de Premium automatique pour Trivida
    // premiumPlan reste à null (valeur par défaut du kernel)
    payload.isPremium = false;
    payload.premiumPlan = null;
    payload.premiumUntil = null;

    const user = await User.create(payload);
    const token = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    const hashedRt = hashToken(refreshToken);

    // Stockage du RT haché
    user.refreshTokens = [hashedRt];
    await user.save();

    const shouldSend = (config.SEND_WELCOME_EMAIL_ON_REGISTER || 'true') === 'true';
    if (shouldSend && user?.email) {
        const appName = req.appName || config.APP_NAME || 'Trivida';
        Promise.resolve(
            emailService.sendGenericEmail({
                email: user.email,
                subject: `Bienvenue sur ${appName}`,
                html: emailService.generateWelcomeTemplate(user.name || '', appName),
            })
        ).catch(() => {});
    }
    
    const userData = user.toObject();
    delete userData.refreshTokens;
    sendResponse(res, { ...userData, token, refreshToken, user: userData }, 'Inscription réussie');
});

// --- REFRESH TOKEN (réutilise le kernel) ---
exports.refresh = require('../../../../../dry/modules/user/auth.controller').refresh;

// --- GET ME (réutilise le kernel) ---
exports.getMe = require('../../../../../dry/modules/user/auth.controller').getMe;

// --- UPDATE ME (réutilise le kernel) ---
exports.updateMe = require('../../../../../dry/modules/user/auth.controller').updateMe;

// --- CHANGE PASSWORD (réutilise le kernel) ---
exports.changePassword = require('../../../../../dry/modules/user/auth.controller').changePassword;

// --- REQUEST PASSWORD RESET (réutilise le kernel) ---
exports.requestPasswordReset = require('../../../../../dry/modules/user/auth.controller').requestPasswordReset;

// --- VERIFY RESET CODE (réutilise le kernel) ---
exports.verifyResetCode = require('../../../../../dry/modules/user/auth.controller').verifyResetCode;

// --- RESET PASSWORD (réutilise le kernel) ---
exports.resetPassword = require('../../../../../dry/modules/user/auth.controller').resetPassword;

// --- LOGOUT (réutilise le kernel) ---
exports.logout = require('../../../../../dry/modules/user/auth.controller').logout;

// --- DELETE ACCOUNT (suppression définitive du compte + données Trivida, exigence Google Play) ---
exports.deleteMe = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const userId = req.user._id;

    for (const [entity, { modelName, schema }] of Object.entries(SCHEMA_MAP)) {
        try {
            const Model = req.getModel(modelName, schema);
            await Model.deleteMany({ userId });
        } catch (error) {
            console.error(`[DeleteAccount] Erreur suppression ${entity}:`, error.message);
        }
    }

    await User.findByIdAndDelete(userId);

    sendResponse(res, null, 'Compte supprimé définitivement');
});
