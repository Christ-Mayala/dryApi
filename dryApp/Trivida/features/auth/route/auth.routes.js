const express = require('express');
const router = express.Router();

// Import des contrôleurs spécifiques Trivida
const { 
    login, 
    register, 
    refresh, 
    getMe, 
    updateMe, 
    changePassword,
    requestPasswordReset,
    verifyResetCode,
    resetPassword,
    logout,
    deleteMe
} = require('../controller/trividaAuth.controller');

// Import du middleware d'auth et du rate limit
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const authLimiter = require('../../../../../dry/middlewares/protection/authRateLimit');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');

// --- ROUTES D'AUTHENTIFICATION TRIVIDA ---

// Authentification publique (avec rate-limit)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
// Refresh : rate limit dédié (évite le bypass quand
// RATE_LIMIT_SKIP_AUTHENTICATED est actif sur le rate limitur global).
// PAS de protect : le token d'accès peut être expiré — c'est justement le
// moment où le client a besoin de rafraîchir. L'authentification du refresh
// repose exclusivement sur le refresh token (vérifié + haché en base + rotation).
router.post('/refresh', authLimiter, refresh);

// Profil (protégé par JWT)
router.get('/profile', protect, withAudit('TRIVIDA_GET_PROFILE'), getMe);
router.patch('/profile', protect, withAudit('TRIVIDA_UPDATE_PROFILE'), upload.single('avatar'), updateMe);

// Gestion du mot de passe
router.patch('/password', protect, withAudit('TRIVIDA_CHANGE_PASSWORD'), changePassword);
// Password reset : limiter les tentatives de vérification du code à 6 chiffres
// (évite le brute-force sur /verify sans modifier le format de code ni casser
// les clients existants qui appellent déjà cette route)
const verifyResetCodeLimiter = authLimiter;
router.post('/password-reset/request', authLimiter, requestPasswordReset);
router.post('/password-reset/verify', verifyResetCodeLimiter, verifyResetCode);
router.post('/password-reset/reset', authLimiter, resetPassword);

// Déconnexion
router.post('/logout', protect, withAudit('TRIVIDA_LOGOUT'), logout);

// Suppression définitive du compte et des données associées
router.delete('/account', protect, withAudit('TRIVIDA_DELETE_ACCOUNT'), deleteMe);

// Clé API FreeLLM globale (protégée par JWT)
router.get('/api-key', protect, async (req, res) => {
  const sendResponse = require('../../../../../dry/utils/http/response');
  const key = process.env.FREELLM_API_KEY;
  if (!key) {
    return sendResponse(res, null, 'Clé API FreeLLM non configurée', false, undefined, 404);
  }
  sendResponse(res, { key }, 'Clé API récupérée');
});

module.exports = router;
