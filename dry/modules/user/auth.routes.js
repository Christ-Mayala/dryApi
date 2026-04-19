const express = require('express');
const router = express.Router();

// 1. Import des contrôleurs (login, register, profil)
const { login, register, getMe, updateMe, changePassword, requestPasswordReset, verifyResetCode, resetPassword, refresh } = require('./auth.controller');


const upload = require('../../services/cloudinary/cloudinary.service');

// 2. Import du middleware d'auth et du rate limit spécifique
const { protect } = require('../../middlewares/protection/auth.middleware');
const authLimiter = require('../../middlewares/protection/authRateLimit');
const { withAudit } = require('../../middlewares/audit');

// --- ROUTES ---

// Authentification (protégées par un rate-limit spécifique)
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.post('/refresh', refresh);

// Profil (protégé par JWT, utilisé par le frontend pour recharger la session)
router.get('/profile', protect, withAudit('GET_PROFILE'), getMe);
router.patch('/profile', protect, withAudit('UPDATE_PROFILE'), upload.single('avatar'), updateMe);

// Changement de mot de passe (protégé)
router.patch('/password', protect, withAudit('CHANGE_PASSWORD'), changePassword);

// Réinitialisation de mot de passe (publique)
router.post('/password-reset/request', authLimiter, requestPasswordReset);
router.post('/password-reset/verify', verifyResetCode);
router.post('/password-reset/reset', authLimiter, resetPassword);



module.exports = router;
