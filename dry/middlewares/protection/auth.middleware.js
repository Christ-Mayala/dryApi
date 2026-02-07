const asyncHandler = require('express-async-handler');
const { verifyToken } = require('../../utils/auth/jwt.util');
// Mise a jour chemin response (On remonte de middlewares/protection -> middlewares -> dry -> utils)
const sendResponse = require('../../utils/http/response');

const getTokenFromRequest = (req, allowQuery = false) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return req.headers.authorization.split(' ')[1];
    }
    if (allowQuery && req.query && typeof req.query.token === 'string') {
        return req.query.token;
    }
    return null;
};

const resolveUserFromToken = async (req, res, token) => {
    try {
        const decoded = verifyToken(token);
        const User = req.getModel('User');

        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) return sendResponse(res, null, 'Utilisateur introuvable', false);
        if (req.user.status === 'deleted' || req.user.status === 'banned') {
            return sendResponse(res, null, 'Compte desactive', false);
        }

        return true;
    } catch (error) {
        return sendResponse(res, null, 'Non autorise, token invalide', false);
    }
};

const protect = asyncHandler(async (req, res, next) => {
    const token = getTokenFromRequest(req, false);
    if (!token) return sendResponse(res, null, 'Non autorise, aucun token fourni', false);

    const ok = await resolveUserFromToken(req, res, token);
    if (ok === true) next();
});

const protectWithQueryToken = asyncHandler(async (req, res, next) => {
    const token = getTokenFromRequest(req, true);
    if (!token) return sendResponse(res, null, 'Non autorise, aucun token fourni', false);

    const ok = await resolveUserFromToken(req, res, token);
    if (ok === true) next();
});

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return sendResponse(res, null, 'Non authentifie', false);
        if (!roles.includes(req.user.role)) {
            return sendResponse(res, null, `Role '${req.user.role}' non autorise`, false);
        }
        next();
    };
};

module.exports = { protect, protectWithQueryToken, authorize };
