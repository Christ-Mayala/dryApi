const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const authController = require('../controller/auth.controller');

/**
 * Auth PharmaPilot — expose sous /api/v1/pharmapilot/auth
 * (l'endpoint natif /api/v1/pharmapilot/user/* reste egalement disponible).
 */
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

router.get('/profile', protect, resolveTenant, authController.profile);
router.patch('/profile', protect, resolveTenant, authController.updateMe);
router.post('/change-password', protect, authController.changePassword);
router.post('/logout', protect, authController.logout);

module.exports = router;
