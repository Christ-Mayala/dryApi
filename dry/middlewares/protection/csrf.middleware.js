const csrf = require('csurf');
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');

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
    try {
        // Le token CSRF est automatiquement ajouté aux cookies par `csurf`
        // On l'expose aussi dans `res.locals` pour les réponses API
        res.locals.csrfToken = req.csrfToken();
        next();
    } catch (error) {
        // Si CSRF n'est pas initialisé, on continue sans token
        next();
    }
});

// Routes qui n'ont PAS besoin de protection CSRF
const NO_CSRF_ROUTES = [
    // Auth routes (login/register sont publics)
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    
    // Routes publiques de lecture
    '/health',
    '/health/live',
    '/health/ready',
    
    // Routes publiques d'API (GET seulement)
    // Les méthodes GET, OPTIONS, HEAD sont déjà exclues par CSRF
];

// Middleware pour vérifier si une route nécessite une protection CSRF
const requiresCsrfProtection = (req, res, next) => {
    const path = req.path;
    const method = req.method;
    
    // Les méthodes safe n'ont pas besoin de CSRF
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
        return next();
    }
    
    // Vérifier si la route est dans la liste des exceptions
    const needsCsrf = !NO_CSRF_ROUTES.some(route => {
        // Support des wildcards (ex: /auth/*)
        if (route.endsWith('/*')) {
            const baseRoute = route.slice(0, -2);
            return path.startsWith(baseRoute);
        }
        return path === route;
    });
    
    if (needsCsrf) {
        return csrfProtection(req, res, next);
    }
    
    next();
};

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

// Middleware combiné pour appliquer CSRF sélectivement
const applyCsrfSelectively = [requiresCsrfProtection, setCsrfToken];

module.exports = {
    csrfProtection,
    setCsrfToken,
    verifyCsrfToken,
    handleCsrfError,
    requiresCsrfProtection,
    applyCsrfSelectively,
    NO_CSRF_ROUTES
};
