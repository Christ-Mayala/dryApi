const { doubleCsrf } = require('csrf-csrf');
const sendResponse = require('../../utils/http/response');
const config = require('../../../config/database');

// ─── Initialisation csrf-csrf (double-submit cookie pattern) ─────────────────
//
// csrf-csrf remplace csurf (déprécié). Il utilise le pattern "double submit
// cookie" : un cookie signé HMAC + un token dans le header/body.
// Le secret HMAC est tiré de JWT_SECRET pour éviter d'introduire une nouvelle
// variable d'environnement.
//
const {
  generateToken,   // (req, res, overwrite?) → string  — génère et pose le cookie
  doubleCsrfProtection, // middleware Express standard
} = doubleCsrf({
  getSecret: () => config.JWT_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    // __Host- prefix exige path=/ et secure=true en prod, domain absent
    path: '/',
  },
  // Cherche le token dans :
  //   1. Le header X-CSRF-Token (API REST / React Native)
  //   2. Le champ _csrf du body (formulaires HTML classiques)
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || req.body?._csrf,
  size: 64,
});

// ─── Routes exemptées de vérification CSRF ───────────────────────────────────
const NO_CSRF_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/health',
  '/health/live',
  '/health/ready',
];

// ─── setCsrfToken — expose le token dans le cookie + res.locals ──────────────
const setCsrfToken = (req, res, next) => {
  try {
    res.locals.csrfToken = generateToken(req, res);
  } catch {
    // Si le contexte ne permet pas de générer un token, on continue sans
  }
  next();
};

// ─── requiresCsrfProtection — skip les méthodes safe et les routes exclues ───
const requiresCsrfProtection = (req, res, next) => {
  const { path, method } = req;

  // GET / OPTIONS / HEAD sont des méthodes "safe" — pas de vérification CSRF
  if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
    return next();
  }

  const isExcluded = NO_CSRF_ROUTES.some((route) => {
    if (route.endsWith('/*')) {
      return path.startsWith(route.slice(0, -2));
    }
    return path === route;
  });

  if (isExcluded) return next();

  // Déléguer la vérification à csrf-csrf
  return doubleCsrfProtection(req, res, next);
};

// ─── verifyCsrfToken — alias conservé pour la compatibilité des imports ──────
const verifyCsrfToken = (_req, _res, next) => next();

// ─── handleCsrfError — gestion de l'erreur 403 csrf-csrf ─────────────────────
const handleCsrfError = (err, req, res, next) => {
  // csrf-csrf lève une erreur avec le code 'EBADCSRFTOKEN' ou message 'invalid csrf token'
  if (
    err.code === 'EBADCSRFTOKEN' ||
    err.message === 'invalid csrf token' ||
    err.status === 403
  ) {
    return sendResponse(res, null, 'Token CSRF invalide ou manquant', false, 403);
  }
  next(err);
};

// ─── applyCsrfSelectively — middleware combiné ────────────────────────────────
const applyCsrfSelectively = [requiresCsrfProtection, setCsrfToken];

module.exports = {
  // Exposé pour usage direct si nécessaire
  doubleCsrfProtection,
  generateToken,
  // Alias de compatibilité avec l'ancien nommage csurf
  csrfProtection: doubleCsrfProtection,
  setCsrfToken,
  verifyCsrfToken,
  handleCsrfError,
  requiresCsrfProtection,
  applyCsrfSelectively,
  NO_CSRF_ROUTES,
};
