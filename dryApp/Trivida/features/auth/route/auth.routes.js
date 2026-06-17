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
    logout
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
router.post('/refresh', refresh);

// Profil (protégé par JWT)
router.get('/profile', protect, withAudit('TRIVIDA_GET_PROFILE'), getMe);
router.patch('/profile', protect, withAudit('TRIVIDA_UPDATE_PROFILE'), upload.single('avatar'), updateMe);

// Gestion du mot de passe
router.patch('/password', protect, withAudit('TRIVIDA_CHANGE_PASSWORD'), changePassword);
router.post('/password-reset/request', authLimiter, requestPasswordReset);
router.post('/password-reset/verify', verifyResetCode);
router.post('/password-reset/reset', authLimiter, resetPassword);

// Déconnexion
router.post('/logout', protect, withAudit('TRIVIDA_LOGOUT'), logout);

module.exports = router;
