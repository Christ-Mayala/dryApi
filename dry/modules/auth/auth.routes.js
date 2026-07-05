const express = require('express');
const passport = require('passport');
const { signAccessToken, signRefreshToken } = require('../../utils/auth/jwt.util');

const router = express.Router();

/**
 * GET /api/auth/google
 * Initie le flux OAuth Google côté serveur (pattern SCIM).
 * Query params : app (tenant), redirect_uri (callback scheme)
 */
router.get('/auth/google', (req, res, next) => {
  const { app, redirect_uri } = req.query;

  if (!app) {
    return res.status(400).json({
      success: false,
      message: "Paramètre 'app' requis. Ex: /api/auth/google?app=trivida&redirect_uri=...",
    });
  }
  if (!redirect_uri) {
    return res.status(400).json({
      success: false,
      message: "Paramètre 'redirect_uri' requis.",
    });
  }

  req.session.googleRedirectUri = redirect_uri;

  const state = JSON.stringify({ app, redirect_uri });
  console.log('[GoogleAuth] Init OAuth pour', app, '→', redirect_uri);

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false,
  })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Callback OAuth — Passport échange le code, upsertGoogleUser crée/trouve
 * l'utilisateur, on génère les JWT et on redirige vers l'app.
 */
router.get(
  '/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
      if (err || !user) {
        console.error('[GoogleAuth] Échec auth:', err?.message || 'Utilisateur absent');
        return res.redirect('/api/auth/google/failure');
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user;

      const token = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      let redirectUri = 'com.christ_mayala.trivida://oauth/callback';

      if (req.session.googleRedirectUri) {
        redirectUri = req.session.googleRedirectUri;
        delete req.session.googleRedirectUri;
      } else if (req.query.state) {
        try {
          const sd = JSON.parse(req.query.state);
          if (sd.redirect_uri) redirectUri = sd.redirect_uri;
        } catch (_) {}
      }

      const url = `${redirectUri}?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      console.log('[GoogleAuth] ✅ Succès', user.email || user._id);
      res.redirect(url);
    } catch (error) {
      console.error('[GoogleAuth] Erreur callback:', error);
      res.redirect('/api/auth/google/failure');
    }
  }
);

/**
 * GET /api/auth/google/failure
 * Redirige vers l'app avec une erreur.
 */
router.get('/auth/google/failure', (req, res) => {
  let redirectUri = 'com.christ_mayala.trivida://oauth/callback';
  if (req.session.googleRedirectUri) {
    redirectUri = req.session.googleRedirectUri;
    delete req.session.googleRedirectUri;
  }
  const url = `${redirectUri}?error=${encodeURIComponent('Authentification Google échouée.')}`;
  res.redirect(url);
});

module.exports = router;
