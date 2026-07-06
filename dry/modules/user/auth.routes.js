const express = require('express');
const router = express.Router();

// 1. Import des contrôleurs (login, register, profil)
const { login, register, getMe, updateMe, changePassword, requestPasswordReset, verifyResetCode, resetPassword, refresh, logout } = require('./auth.controller');
const { getAiQuota, consumeAiRequest } = require('./aiQuota.controller');


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
router.post('/logout', protect, withAudit('LOGOUT'), logout);

// Profil (protégé par JWT, utilisé par le frontend pour recharger la session)
router.get('/profile', protect, withAudit('GET_PROFILE'), getMe);
router.patch('/profile', protect, withAudit('UPDATE_PROFILE'), upload.single('avatar'), updateMe);

// Changement de mot de passe (protégé)
router.patch('/password', protect, withAudit('CHANGE_PASSWORD'), changePassword);

// Réinitialisation de mot de passe (publique)
router.post('/password-reset/request', authLimiter, requestPasswordReset);
router.post('/password-reset/verify', verifyResetCode);
router.post('/password-reset/reset', authLimiter, resetPassword);


// IA Quota (protege par JWT + audit)
router.get('/ai-quota', protect, withAudit('TRIVIDA_AI_QUOTA'), getAiQuota);
router.post('/ai-request', protect, withAudit('TRIVIDA_AI_REQUEST'), consumeAiRequest);

// Clé API FreeLLM globale (protégée par JWT)
router.get('/api-key', protect, async (req, res) => {
  const sendResponse = require('../../utils/http/response');
  const key = process.env.FREELLM_API_KEY;
  if (!key) {
    return sendResponse(res, null, 'Clé API FreeLLM non configurée', false, undefined, 404);
  }
  sendResponse(res, { key }, 'Clé API récupérée');
});

// Historique des paiements
router.get('/payments', protect, async (req, res) => {
  try {
    const User = req.getModel('User');
    const user = await User.findById(req.user._id).select('paymentHistory').lean();
    const history = (user?.paymentHistory || []).slice().reverse(); // plus récent en premier
    const sendResponse = require('../../utils/http/response');
    sendResponse(res, history, 'Historique des paiements');
  } catch (err) {
    const sendResponse = require('../../utils/http/response');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});


module.exports = router;
