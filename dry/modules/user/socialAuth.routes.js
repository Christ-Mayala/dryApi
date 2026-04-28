const express = require('express');
const passport = require('passport');
const config = require('../../../config/database');
const { signAccessToken, signRefreshToken } = require('../../utils/auth/jwt.util');
const { refreshCookieOptions, accessTokenCookieOptions } = require('../../utils/http/cookies');

const router = express.Router();

const getFrontendUrl = (req) => {
  // 1. Priorité à l'URL stockée en session lors de l'initialisation
  if (req?.session?.oauthRedirectUri) return req.session.oauthRedirectUri;

  // 2. Sinon, essayer de trouver une URL spécifique à l'application dans la config
  const appName = normalize(req?.session?.oauthAppName || req?.query?.app);
  if (appName) {
    const appFrontendUrl = process.env[`${appName.toUpperCase()}_FRONTEND_URL`];
    if (appFrontendUrl) return appFrontendUrl;
  }

  // 3. Fallback sur la config globale
  return config.FRONTEND_URL || 'http://localhost:3000';
};

const normalize = (value) => String(value ?? '').trim();

const isUrlAllowed = (url) => {
  if (!url) return false;
  try {
    const origin = new URL(url).origin;
    const allowed = String(config.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    return allowed.includes(origin);
  } catch (_) {
    return false;
  }
};

/**
 * Notes d'architecture (multi-tenant):
 * - Les routes applicatives (/api/v1/:app/...) utilisent des modèles liés à la DB du tenant
 *   via `req.getModel()` (injecté par le bootloader).
 * - Les routes sociales (/api/auth/...) sont montées globalement, donc on doit transporter
 *   le tenant (nom du dossier dans `dryApp/`) sur toute la redirection OAuth.
 *
 * Ici on exige `?app=SCIM` (ou autre) à l'init, puis on le stocke en session pour le callback.
 */
const persistOAuthContext = (req, provider) => {
  const appName = normalize(req?.query?.app);
  if (!appName) return { ok: false, appName: null };
  if (!req.session) throw new Error('Session manquante: express-session est requis pour OAuth.');

  req.session.oauthAppName = appName;
  req.session.oauthProvider = provider;

  // Optionnel: On peut passer un redirect_uri spécifique depuis le front
  const customRedirect = req.query.redirect_uri;
  if (customRedirect && isUrlAllowed(customRedirect)) {
    req.session.oauthRedirectUri = customRedirect;
  } else {
    // Sinon on essaie de déduire l'origine depuis le Referer pour le multi-tenant dynamique
    const referer = req.headers.referer;
    if (referer && isUrlAllowed(referer)) {
      req.session.oauthRedirectUri = new URL(referer).origin;
    }
  }

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

  const frontendUrl = getFrontendUrl(req);
  const url = new URL('/login', frontendUrl);
  url.searchParams.set('error', 'provider_not_configured');
  url.searchParams.set('provider', provider);
  return res.redirect(url.toString());
};

const redirectToFrontendCallback = async (req, res, provider, appName) => {
  const frontendUrl = getFrontendUrl(req);

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

  // Aligné avec `dry/modules/user/auth.controller.js` :
  // - Access token pour authentifier les requêtes API
  // - Refresh token pour rafraîchir la session sans re-login
  const token = signAccessToken(req.user._id);
  const refreshToken = signRefreshToken(req.user._id);

  // Si on est dans un contexte multi-tenant (appName présent), on enregistre le RT dans la DB du tenant
  if (appName && req.user && typeof req.user.save === 'function') {
    try {
      if (!req.user.refreshTokens) req.user.refreshTokens = [];
      req.user.refreshTokens.push(refreshToken);
      if (req.user.refreshTokens.length > 10) {
        req.user.refreshTokens = req.user.refreshTokens.slice(-10);
      }
      await req.user.save();
      
      // On définit aussi les cookies pour le mode "cookie_managed" du frontend
      res.cookie('rt', refreshToken, refreshCookieOptions());
      res.cookie('jwt', token, accessTokenCookieOptions());
    } catch (err) {
      console.error('[OAuth] Erreur lors de la sauvegarde du refresh token:', err);
    }
  }

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
  
  // Nettoyage final de la session OAuth
  if (req.session) {
    delete req.session.oauthAppName;
    delete req.session.oauthProvider;
    delete req.session.oauthRedirectUri;
  }

  return res.redirect(url.toString());
};

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!isStrategyAvailable('google')) return handleProviderUnavailable(req, res, 'google');

  const { ok } = persistOAuthContext(req, 'google');
  if (!ok) {
    const message = "Parametre requis manquant: `app` (ex: /api/auth/google?app=SCIM).";
    if (wantsJson(req)) return res.status(400).json({ success: false, message, provider: 'google' });
    const url = new URL('/login', getFrontendUrl(req));
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
  return passport.authenticate('google', { session: false }, async (error, user) => {
    if (error) {
      if (wantsJson(req)) {
        return res.status(401).json({
          success: false,
          provider: 'google',
          message: error.message || 'OAuth error',
        });
      }
      const frontendUrl = getFrontendUrl(req);
      const url = new URL('/login', frontendUrl);
      url.searchParams.set('error', 'google');
      url.searchParams.set('message', error.message || 'OAuth error');
      return res.redirect(url.toString());
    }
    req.user = user;
    const appName = normalize(req?.session?.oauthAppName);
    return await redirectToFrontendCallback(req, res, 'google', appName || null);
  })(req, res, next);
});

// Facebook OAuth
router.get('/facebook', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) return handleProviderUnavailable(req, res, 'facebook');

  const { ok } = persistOAuthContext(req, 'facebook');
  if (!ok) {
    const message = "Parametre requis manquant: `app` (ex: /api/auth/facebook?app=SCIM).";
    if (wantsJson(req)) return res.status(400).json({ success: false, message, provider: 'facebook' });
    const url = new URL('/login', getFrontendUrl(req));
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
  return passport.authenticate('facebook', { session: false }, async (error, user) => {
    if (error) {
      if (wantsJson(req)) {
        return res.status(401).json({
          success: false,
          provider: 'facebook',
          message: error.message || 'OAuth error',
        });
      }
      const frontendUrl = getFrontendUrl(req);
      const url = new URL('/login', frontendUrl);
      url.searchParams.set('error', 'facebook');
      url.searchParams.set('message', error.message || 'OAuth error');
      return res.redirect(url.toString());
    }
    req.user = user;
    const appName = normalize(req?.session?.oauthAppName);
    return await redirectToFrontendCallback(req, res, 'facebook', appName || null);
  })(req, res, next);
});

module.exports = router;
