const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const config = require('../../../config/database');
const getModel = require('../factories/modelFactory');

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const isConfigured = (value) => Boolean(String(value || '').trim());

const buildCallbackUrl = (overrideUrl, path) => {
  const explicit = trimTrailingSlash(overrideUrl);
  if (explicit) return explicit;
  const base = trimTrailingSlash(config.SERVER_URL || 'http://127.0.0.1:5000');
  return `${base}${path}`;
};

/**
 * Social auth is mounted globally at `/api/auth/...` (see bootloader).
 * App APIs are multi-tenant and use a tenant DB connection.
 *
 * We transport the tenant name via the OAuth 'state' parameter (stateless).
 * On callback, we parse it from `req.query.state`.
 */
const resolveTenantAppName = (req) => {
  // 1. Essayer de trouver dans le paramètre 'state' d'OAuth
  if (req?.query?.state) {
    try {
      const state = JSON.parse(req.query.state);
      if (state.app) return String(state.app).trim();
    } catch (_) {
      // Pas du JSON, peut être un state simple ou celui de Passport
    }
  }

  // 2. Fallback sur les query params directs
  const fromQuery = req?.query?.app;
  if (fromQuery) return String(fromQuery).trim();

  // 3. Fallback sur la session (legacy)
  const fromSession = req?.session?.oauthAppName;
  if (fromSession) return String(fromSession).trim();

  return null;
};

const createRandomPassword = () => Math.random().toString(36).slice(-12);

const getDisplayName = (profile, email) => {
  const fromProfile = String(profile?.displayName || '').trim();
  if (fromProfile) return fromProfile;
  const fromEmail = String(email || '').split('@')[0] || 'User';
  return fromEmail;
};

const upsertGoogleUser = async (appName, profile) => {
  const User = getModel(appName, 'User');

  const email = profile?.emails?.[0]?.value;
  if (!email) throw new Error("Google n'a pas fourni d'email pour ce compte.");

  // 1) Provider link first - Toujours selectionner refreshTokens pour la rotation de session
  let user = await User.findOne({ googleId: profile.id }).select('+googleId +refreshTokens');
  if (user) return user;

  // 2) Link by email if already registered
  user = await User.findOne({ email }).select('+refreshTokens');
  if (user) {
    user.googleId = profile.id;
    await user.save();
    return user;
  }

  // 3) Create tenant user
  const displayName = getDisplayName(profile, email);
  const newUser = await User.create({
    googleId: profile.id,
    name: displayName,
    nom: displayName,
    email,
    avatarUrl: profile.photos?.[0]?.value,
    password: createRandomPassword(),
    role: 'user',
  });

  return newUser;
};

const upsertFacebookUser = async (appName, profile) => {
  const User = getModel(appName, 'User');

  // 1) Provider link first - Toujours selectionner refreshTokens pour la rotation de session
  let user = await User.findOne({ facebookId: profile.id }).select('+facebookId +refreshTokens');
  if (user) return user;

  // Facebook may not always return email depending on app permissions/account.
  const email = profile?.emails?.[0]?.value;
  if (email) {
    user = await User.findOne({ email }).select('+refreshTokens');
    if (user) {
      user.facebookId = profile.id;
      await user.save();
      return user;
    }
  }

  if (!email) {
    throw new Error(
      "Facebook n'a pas fourni d'email. Verifie que le scope 'email' est autorise et que le compte possede un email."
    );
  }

  const displayName = getDisplayName(profile, email);
  const newUser = await User.create({
    facebookId: profile.id,
    name: displayName,
    nom: displayName,
    email,
    avatarUrl: profile.photos?.[0]?.value,
    password: createRandomPassword(),
    role: 'user',
  });

  return newUser;
};

const initialize = (app) => {
  // JWT auth does not use passport sessions, but OAuth state + tenant transport uses express-session.
  app.use(passport.initialize());

  // IMPORTANT:
  // - Config comes from `config/database.js` (supports *_DEV / *_TEST / fallback).
  // - Avoid placeholders like "YOUR_*" because providers return opaque errors.

  const googleClientId = config.GOOGLE_CLIENT_ID;
  const googleClientSecret = config.GOOGLE_CLIENT_SECRET;
  const googleCallbackUrl = buildCallbackUrl(config.GOOGLE_CALLBACK_URL, '/api/auth/google/callback');

  if (isConfigured(googleClientId) && isConfigured(googleClientSecret)) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackUrl,
          // On désactive la gestion automatique du state par session de Passport 
          // pour utiliser notre propre 'state' JSON stateless passé dans authenticate().
          state: false, 
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const appName = resolveTenantAppName(req);
            if (!appName) {
              return done(
                new Error('Tenant manquant: utilise /api/auth/google?app=SCIM (ou autre).'),
                false
              );
            }

            const user = await upsertGoogleUser(appName, profile);
            return done(null, user);
          } catch (err) {
            return done(err, false);
          }
        }
      )
    );
  } else {
    console.warn(
      '[passport] Google OAuth desactive: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants.'
    );
  }

  const facebookAppId = config.FACEBOOK_APP_ID;
  const facebookAppSecret = config.FACEBOOK_APP_SECRET;
  const facebookCallbackUrl = buildCallbackUrl(
    config.FACEBOOK_CALLBACK_URL,
    '/api/auth/facebook/callback'
  );

  if (isConfigured(facebookAppId) && isConfigured(facebookAppSecret)) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: facebookAppId,
          clientSecret: facebookAppSecret,
          callbackURL: facebookCallbackUrl,
          profileFields: ['id', 'displayName', 'emails', 'photos'],
          // On désactive la gestion automatique du state par session de Passport 
          // pour utiliser notre propre 'state' JSON stateless passé dans authenticate().
          state: false,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const appName = resolveTenantAppName(req);
            if (!appName) {
              return done(
                new Error('Tenant manquant: utilise /api/auth/facebook?app=SCIM (ou autre).'),
                false
              );
            }

            const user = await upsertFacebookUser(appName, profile);
            return done(null, user);
          } catch (err) {
            return done(err, false);
          }
        }
      )
    );
  } else {
    console.warn(
      '[passport] Facebook OAuth desactive: FACEBOOK_APP_ID / FACEBOOK_APP_SECRET manquants.'
    );
  }

  console.log('Passport plugin initialized.');
};

module.exports = {
  initialize,
  name: 'passport',
  version: '1.2.0',
  description: 'Passport.js authentication plugin for social logins (tenant-aware)',
};

