const csrf = require('csurf');
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/response');

// Initialisation du middleware CSRF
const csrfProtection = csrf({
    cookie: {
        httpOnly: true, // Empêche l'accès via JavaScript
        secure: process.env.NODE_ENV === 'production', // Active le flag Secure en production
        sameSite: 'strict', // Protège contre les attaques CSRF
    },
});

// Middleware pour ajouter le token CSRF aux réponses
const setCsrfToken = asyncHandler((req, res, next) => {
    // Le token CSRF est automatiquement ajouté aux cookies par `csurf`
    // On l'expose aussi dans `res.locals` pour les réponses API
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Middleware pour vérifier le token CSRF sur les requêtes sensibles
const verifyCsrfToken = asyncHandler((req, res, next) => {
    // `csurf` vérifie automatiquement le token CSRF dans les cookies ou les headers
    // Si le token est invalide, `csurf` renvoie une erreur 403
    next();
});

// Gestion des erreurs CSRF
const handleCsrfError = (err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return sendResponse(res, null, 'Token CSRF invalide ou manquant', false, 403);
    }
    next(err); // Passe l'erreur au middleware suivant
};

module.exports = {
    csrfProtection,
    setCsrfToken,
    verifyCsrfToken,
    handleCsrfError,
};
