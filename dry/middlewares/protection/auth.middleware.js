const asyncHandler = require('express-async-handler');
const { verifyToken } = require('../../utils/auth/jwt.util');
const getModel = require('../../core/factories/modelFactory');
// Mise a jour chemin response (On remonte de middlewares/protection -> middlewares -> dry -> utils)
const sendResponse = require('../../utils/http/response');

const getTokenFromRequest = (req, allowQuery = false) => {
    // 1. Chercher dans le header Authorization (Bearer token) en priorité
    // C'est le plus fiable car il est envoyé explicitement par le frontend (Dual-mode)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback sur les cookies (HttpOnly)
    if (req.cookies && req.cookies.jwt) {
        return req.cookies.jwt;
    }
    // 3. Fallback sur la query (si explicitement autorisé)
    if (allowQuery && req.query && typeof req.query.token === 'string') {
        return req.query.token;
    }
    return null;
};

const resolveUserFromToken = async (req, res, token) => {
    try {
        const decoded = verifyToken(token);

        // Utiliser req.getModel si disponible (contexte multi-tenant)
        // Sinon fallback sur getModel avec l'appName de la requête ou 'Trivida' par défaut
        let User;
        if (typeof req.getModel === 'function') {
            User = req.getModel('User');
        } else {
            const appName = req.appName || 'Trivida';
            console.warn(`[protect] req.getModel non injecté pour ${req.originalUrl} — fallback sur getModel('${appName}')`);
            User = getModel(appName, 'User');
        }

        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) return sendResponse(res, null, 'Utilisateur introuvable', false, undefined, 401);
        
        // 🔥 NOUVEAU : Auto-expiration du mode Premium
        if (req.user.isPremium && req.user.premiumUntil && req.user.premiumUntil < new Date()) {
            req.user.isPremium = false;
            req.user.premiumPlan = null;
            if (typeof req.user.save === 'function') {
                await req.user.save();
            }
        }

        if (req.user.status === 'deleted' || req.user.status === 'banned') {
            return sendResponse(res, null, 'Compte désactivé', false, undefined, 403);
        }

        return true;
    } catch (err) {
        return sendResponse(res, null, 'Non autorisé, token invalide', false, undefined, 401);
    }
};

const protect = asyncHandler(async (req, res, next) => {
    const token = getTokenFromRequest(req, false);
    if (!token) return sendResponse(res, null, 'Non autorisé, aucun token fourni', false, undefined, 401);

    const ok = await resolveUserFromToken(req, res, token);
    if (ok === true) next();
});

// Query token désactivé — le token en URL apparaît dans les logs serveur/proxy (risque sécurité)
// Utiliser le header Authorization: Bearer <token> à la place
const protectWithQueryToken = protect;

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return sendResponse(res, null, 'Non authentifié', false, undefined, 401);
        if (!roles.includes(req.user.role)) {
            return sendResponse(res, null, `Rôle '${req.user.role}' non autorisé`, false, undefined, 403);
        }
        next();
    };
};

module.exports = { protect, protectWithQueryToken, authorize };
