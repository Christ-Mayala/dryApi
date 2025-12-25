const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
// Mise à jour chemin response (On remonte de middlewares/protection -> middlewares -> dry -> utils)
const sendResponse = require('../../utils/response');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const User = req.getModel('User');
            
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) return sendResponse(res, null, 'Utilisateur introuvable', false);
            if (req.user.status === 'deleted' || req.user.status === 'banned') {
                return sendResponse(res, null, 'Compte désactivé', false);
            }

            next();
        } catch (error) {
            return sendResponse(res, null, 'Non autorisé, token invalide', false);
        }
    } else {
        return sendResponse(res, null, 'Non autorisé, aucun token fourni', false);
    }
});

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return sendResponse(res, null, 'Non authentifié', false);
        if (!roles.includes(req.user.role)) {
            return sendResponse(res, null, `Rôle '${req.user.role}' non autorisé`, false);
        }
        next();
    };
};

module.exports = { protect, authorize };