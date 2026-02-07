const express = require('express');






const router = express.Router();

// 1. Import des contrôleurs (login, register, profil)
const { login, register, getMe, updateMe } = require('./auth.controller');
const upload = require('../../services/cloudinary/cloudinary.service');

// 2. Import du middleware d'auth et du rate limit spécifique
const { protect } = require('../../middlewares/protection/auth.middleware');
const authLimiter = require('../../middlewares/protection/authRateLimit');
const { withAudit } = require('../../middlewares/audit');

// --- ROUTES ---

// Authentification (protégées par un rate-limit spécifique)
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);

// Profil (protégé par JWT, utilisé par le frontend pour recharger la session)
router.get('/profile', protect, withAudit('GET_PROFILE'), getMe);
router.patch('/profile', protect, withAudit('UPDATE_PROFILE'), upload.single('avatar'), updateMe);

module.exports = router;
