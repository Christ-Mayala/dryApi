const express = require('express');
const passport = require('passport');
const config = require('../../../config/database');
const { signAccessToken, signRefreshToken } = require('../../utils/auth/jwt.util');

const router = express.Router();

const getFrontendUrl = () => config.FRONTEND_URL || 'http://localhost:3000';

const normalize = (value) => String(value ?? '').trim();

/**
 * Notes d'architecture (multi-tenant):
 * - Les routes applicatives (/api/v1/:app/...) utilisent des modÃ¨les liÃ©s Ã  la DB du tenant
 *   via `req.getModel()` (injectÃ© par le bootloader).
 * - Les routes sociales (/api/auth/...) sont montÃ©es globalement, donc on doit transporter
 *   le tenant (nom du dossier dans `dryApp/`) sur toute la redirection OAuth.
 *
 * Ici on exige `?app=SCIM` (ou autre) Ã  l'init, puis on le stocke en session pour le callback.
 * Le plugin Passport lit `req.session.oauthAppName` (via `passReqToCallback`) pour crÃ©er/lier
 * l'utilisateur dans la DB du bon tenant.
 */
const persistOAuthContext = (req, provider) => {
  const appName = normalize(req?.query?.app);
  if (!appName) return { ok: false, appName: null };
  if (!req.session) throw new Error('Session manquante: express-session est requis pour OAuth.');

  req.session.oauthAppName = appName;
  req.session.oauthProvider = provider;
  return { ok: true, appName };
};

const wantsJson = (req) => {
  const accept = String(req?.headers?.accept || '');
  return accept.includes('application/json') || req.xhr === true;
};

const isStrategyAvailable = (name) => Boolean(passport?._strategies?.[name]);

const handleProviderUnavailable = (req, res, provider) => {
  const message = `${provider} OAuth non configuré. Vérifie les variables d'environnement et la doc.`;
  if (wantsJson(req)) {
    return res.status(503).json({ success: false, message, provider });
  }

  const frontendUrl = getFrontendUrl();
  const url = new URL('/login', frontendUrl);
  url.searchParams.set('error', 'provider_not_configured');
  url.searchParams.set('provider', provider);
  return res.redirect(url.toString());
};

const redirectToFrontendCallback = (req, res, provider, appName) => {
  const frontendUrl = getFrontendUrl();

  if (!req.user) {
    if (wantsJson(req)) {
      return res.status(401).json({
        success: false,
        provider,
        app: appName || null,
        message: 'authentication_failed',
      });
    }
    const url = new URL('/login', frontendUrl);
    url.searchParams.set('error', 'authentication_failed');
    url.searchParams.set('provider', provider);
    return res.redirect(url.toString());
  }

  // AlignÃ© avec `dry/modules/user/auth.controller.js` :
  // - Access token pour authentifier les requÃªtes API
  // - Refresh token pour rafraÃ®chir la session sans re-login
  const token = signAccessToken(req.user._id);
  const refreshToken = signRefreshToken(req.user._id);

  if (wantsJson(req)) {
    return res.status(200).json({
      success: true,
      provider,
      app: appName || null,
      token,
      refreshToken,
      user: req.user,
    });
  }

  const url = new URL('/auth/callback', frontendUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('refreshToken', refreshToken);
  url.searchParams.set('provider', provider);
  if (appName) url.searchParams.set('app', appName);
  return res.redirect(url.toString());
};

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!isStrategyAvailable('google')) return handleProviderUnavailable(req, res, 'google');

  const { ok } = persistOAuthContext(req, 'google');
  if (!ok) {
    const message = "Parametre requis manquant: `app` (ex: /api/auth/google?app=SCIM).";
    if (wantsJson(req)) return res.status(400).json({ success: false, message, provider: 'google' });
    const url = new URL('/login', getFrontendUrl());
    url.searchParams.set('error', 'missing_app');
    url.searchParams.set('provider', 'google');
    return res.redirect(url.toString());
  }

  // Sauvegarde explicite: selon le store/proxy, ca evite de perdre oauthAppName avant redirect.
  return req.session.save(() =>
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
  );
});

router.get('/google/callback', (req, res, next) => {
  if (!isStrategyAvailable('google')) return handleProviderUnavailable(req, res, 'google');
  return passport.authenticate('google', { session: false }, (error, user) => {
    if (error) {
      if (wantsJson(req)) {
        return res.status(401).json({
          success: false,
          provider: 'google',
          message: error.message || 'OAuth error',
        });
      }
      const frontendUrl = getFrontendUrl();
      const url = new URL('/login', frontendUrl);
      url.searchParams.set('error', 'google');
      url.searchParams.set('message', error.message || 'OAuth error');
      return res.redirect(url.toString());
    }
    req.user = user;
    const appName = normalize(req?.session?.oauthAppName);
    if (req.session) {
      delete req.session.oauthAppName;
      delete req.session.oauthProvider;
    }
    return redirectToFrontendCallback(req, res, 'google', appName || null);
  })(req, res, next);
});

// Facebook OAuth
router.get('/facebook', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) return handleProviderUnavailable(req, res, 'facebook');

  const { ok } = persistOAuthContext(req, 'facebook');
  if (!ok) {
    const message = "Parametre requis manquant: `app` (ex: /api/auth/facebook?app=SCIM).";
    if (wantsJson(req)) return res.status(400).json({ success: false, message, provider: 'facebook' });
    const url = new URL('/login', getFrontendUrl());
    url.searchParams.set('error', 'missing_app');
    url.searchParams.set('provider', 'facebook');
    return res.redirect(url.toString());
  }

  return req.session.save(() =>
    passport.authenticate('facebook', { scope: ['email'] })(req, res, next)
  );
});

router.get('/facebook/callback', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) return handleProviderUnavailable(req, res, 'facebook');
  return passport.authenticate('facebook', { session: false }, (error, user) => {
    if (error) {
      if (wantsJson(req)) {
        return res.status(401).json({
          success: false,
          provider: 'facebook',
          message: error.message || 'OAuth error',
        });
      }
      const frontendUrl = getFrontendUrl();
      const url = new URL('/login', frontendUrl);
      url.searchParams.set('error', 'facebook');
      url.searchParams.set('message', error.message || 'OAuth error');
      return res.redirect(url.toString());
    }
    req.user = user;
    const appName = normalize(req?.session?.oauthAppName);
    if (req.session) {
      delete req.session.oauthAppName;
      delete req.session.oauthProvider;
    }
    return redirectToFrontendCallback(req, res, 'facebook', appName || null);
  })(req, res, next);
});

module.exports = router;
