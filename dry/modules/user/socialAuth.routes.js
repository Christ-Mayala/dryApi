const express = require('express');
const passport = require('passport');
const config = require('../../../config/database');
const { signAccessToken, signRefreshToken, hashToken } = require('../../utils/auth/jwt.util');
const { refreshCookieOptions, accessTokenCookieOptions } = require('../../utils/http/cookies');

const router = express.Router();

const getFrontendUrl = (req, stateContext = {}) => {
  // 1. Si on a une URL de redirection validée dans le state (reçue de Google/FB)
  if (stateContext.redirect) return stateContext.redirect;
  
  // 2. Fallback sur la config globale
  const rawFrontendUrl = String(config.FRONTEND_URL || '');
  if (!rawFrontendUrl) {
    throw new Error('FRONTEND_URL global manquant dans la configuration');
  }

  // Si FRONTEND_URL contient plusieurs URLs (séparées par des virgules), on prend la première par défaut
  const urls = rawFrontendUrl.split(',').map(u => u.trim()).filter(Boolean);
  return urls[0];
};

const normalize = (value) => String(value ?? '').trim();

// Liste blanche stricte des origines autorisées
const ALLOWED_ORIGINS_SET = new Set(
  String(config.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const isUrlAllowed = (url) => {
  if (!url) return false;
  try {
    const origin = new URL(url).origin;
    return ALLOWED_ORIGINS_SET.has(origin);
  } catch (_) {
    return false;
  }
};

/**
 * Prépare le contexte OAuth pour le transporter via le paramètre 'state' (stateless).
 */
const getOAuthContext = (req) => {
  const appName = normalize(req?.query?.app);
  if (!appName) return { ok: false, error: "Paramètre 'app' manquant." };

  const context = { app: appName };

  // 1. Priorité au redirect_uri explicite
  const customRedirect = req.query.redirect_uri;
  
  // 2. Détection automatique du site actuel (Origin ou Referer)
  const currentSite = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

  if (customRedirect && isUrlAllowed(customRedirect)) {
    context.redirect = customRedirect;
  } else if (currentSite && isUrlAllowed(currentSite)) {
    // Si on détecte d'où vient l'utilisateur, on le renvoie là-bas
    context.redirect = currentSite;
  }

  return { ok: true, state: JSON.stringify(context), appName };
};

const wantsJson = (req) => {
  const accept = String(req?.headers?.accept || '');
  return accept.includes('application/json') || req.xhr === true;
};

const isStrategyAvailable = (name) => Boolean(passport?._strategies?.[name]);

const handleProviderUnavailable = (req, res, provider) => {
  const message = `${provider} OAuth non configuré. Vérifie les variables d'environnement.`;
  if (wantsJson(req)) {
    return res.status(503).json({ success: false, message, provider });
  }

  try {
    const frontendUrl = getFrontendUrl(req);
    const url = new URL('/login', frontendUrl);
    url.searchParams.set('error', 'provider_not_configured');
    url.searchParams.set('provider', provider);
    return res.redirect(url.toString());
  } catch (err) {
    return res.status(500).send(err.message);
  }
};

const redirectToFrontendCallback = async (req, res, provider, appName, stateContext = {}) => {
  let frontendUrl;
  try {
    frontendUrl = getFrontendUrl(req, stateContext);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

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

  const token = signAccessToken(req.user._id);
  const refreshToken = signRefreshToken(req.user._id);
  const hashedRt = hashToken(refreshToken);

  if (appName && req.user && typeof req.user.save === 'function') {
    try {
      if (!req.user.refreshTokens) req.user.refreshTokens = [];
      req.user.refreshTokens.push(hashedRt);
      if (req.user.refreshTokens.length > 10) {
        req.user.refreshTokens = req.user.refreshTokens.slice(-10);
      }
      
      // Sauvegarde asynchrone pour ne pas bloquer la réponse (optionnel, mais recommandé par le user)
      // Ici on attend quand même car c'est critique pour la session, mais on pourrait optimiser.
      await req.user.save();
      
      res.cookie('rt', refreshToken, refreshCookieOptions());
      res.cookie('jwt', token, accessTokenCookieOptions());
    } catch (err) {
      console.error('[OAuth] Erreur sauvegarde refresh token:', err);
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
  
  // Nettoyage session si elle existe encore (compatibilité)
  if (req.session) {
    req.session.destroy(() => {});
  }

  return res.redirect(url.toString());
};

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!isStrategyAvailable('google')) return handleProviderUnavailable(req, res, 'google');

  const { ok, state, error } = getOAuthContext(req);
  if (!ok) {
    if (wantsJson(req)) return res.status(400).json({ success: false, message: error, provider: 'google' });
    try {
      const url = new URL('/login', getFrontendUrl(req));
      url.searchParams.set('error', 'missing_app');
      url.searchParams.set('provider', 'google');
      return res.redirect(url.toString());
    } catch (err) {
      return res.status(400).send(err.message);
    }
  }

  return passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state // On passe le contexte dans le state OAuth
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!isStrategyAvailable('google')) return handleProviderUnavailable(req, res, 'google');
  
  return passport.authenticate('google', { session: false }, async (error, user) => {
    let stateContext = {};
    try {
      if (req.query.state) stateContext = JSON.parse(req.query.state);
    } catch (_) {}

    if (error || !user) {
      const message = error?.message || 'OAuth error';
      if (wantsJson(req)) return res.status(401).json({ success: false, provider: 'google', message });
      
      try {
        const frontendUrl = getFrontendUrl(req, stateContext);
        const url = new URL('/login', frontendUrl);
        url.searchParams.set('error', 'google');
        url.searchParams.set('message', message);
        return res.redirect(url.toString());
      } catch (err) {
        return res.status(401).send(message);
      }
    }

    req.user = user;
    const appName = stateContext.app;
    return await redirectToFrontendCallback(req, res, 'google', appName, stateContext);
  })(req, res, next);
});

// Facebook OAuth
router.get('/facebook', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) return handleProviderUnavailable(req, res, 'facebook');

  const { ok, state, error } = getOAuthContext(req);
  if (!ok) {
    if (wantsJson(req)) return res.status(400).json({ success: false, message: error, provider: 'facebook' });
    try {
      const url = new URL('/login', getFrontendUrl(req));
      url.searchParams.set('error', 'missing_app');
      url.searchParams.set('provider', 'facebook');
      return res.redirect(url.toString());
    } catch (err) {
      return res.status(400).send(err.message);
    }
  }

  return passport.authenticate('facebook', { 
    scope: ['email'],
    state
  })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) return handleProviderUnavailable(req, res, 'facebook');
  
  return passport.authenticate('facebook', { session: false }, async (error, user) => {
    let stateContext = {};
    try {
      if (req.query.state) stateContext = JSON.parse(req.query.state);
    } catch (_) {}

    if (error || !user) {
      const message = error?.message || 'OAuth error';
      if (wantsJson(req)) return res.status(401).json({ success: false, provider: 'facebook', message });
      
      try {
        const frontendUrl = getFrontendUrl(req, stateContext);
        const url = new URL('/login', frontendUrl);
        url.searchParams.set('error', 'facebook');
        url.searchParams.set('message', message);
        return res.redirect(url.toString());
      } catch (err) {
        return res.status(401).send(message);
      }
    }

    req.user = user;
    const appName = stateContext.app;
    return await redirectToFrontendCallback(req, res, 'facebook', appName, stateContext);
  })(req, res, next);
});

module.exports = router;
