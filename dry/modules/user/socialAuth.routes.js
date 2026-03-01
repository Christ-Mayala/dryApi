const express = require('express');
const passport = require('passport');
const { generateToken } = require('../../utils/auth/jwt.util');
const sendResponse = require('../../utils/http/response');
const router = express.Router();

// Callback pour gérer l'authentification réussie
const socialLoginCallback = (req, res) => {
    if (!req.user) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?error=authentication_failed`);
    }

    // Générer un token JWT pour l'utilisateur
    const token = generateToken(req.user._id);
    
    // Rediriger vers le frontend avec le token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=${req.user.provider || 'social'}`);
};

// Routes d'authentification Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=google', session: false }),
    socialLoginCallback
);

// Routes d'authentification Facebook
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login?error=facebook', session: false }),
    socialLoginCallback
);

module.exports = router;
