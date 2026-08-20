const express = require('express');
const path = require('path');
const compression = require('compression');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');

const config = require('../../config/database');
const logger = require('../utils/logging/logger');
const { maskSensitiveData } = require('../config/logger.config');
const setupSecurity = require('../middlewares/protection/security.middleware');

// Nouveaux middlewares (Phase 2, 3)
const { requestIdMiddleware } = require('../middlewares/requestId.middleware');
const { apiVersionMiddleware } = require('../middlewares/apiVersion.middleware');
const { inputValidationMiddleware } = require('../middlewares/inputValidation.middleware');
const { performanceMonitor } = require('../middlewares/performanceMonitor.middleware');

const getAllowedOrigins = () => {
  const raw = config.ALLOWED_ORIGINS || config.CORS_ORIGINS || '';
  const allowedOrigins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (config.NODE_ENV !== 'production') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      '*'
    );
  }

  return config.NODE_ENV === 'production'
    ? allowedOrigins.filter((origin) => origin !== '*')
    : Array.from(new Set(allowedOrigins));
};

// Same-origin : l'API s'appelle elle-même (ex: le formulaire /system/status qui
// POST vers la même URL). Le navigateur n'applique AUCUNE restriction CORS sur
// une requête same-origin — la bloquer est inutile et casse les formulaires
// auto-soumis. On compare l'hôte de l'origine avec l'hôte de la requête.
const isSameOrigin = (origin, host) => {
  if (!origin || !host) return false;
  const originHost = String(origin).replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
  const requestHost = String(host).toLowerCase();
  return originHost === requestHost;
};

const buildCorsOriginHandler = (allowedOrigins) => (origin, callback) => {
  if (config.NODE_ENV !== 'production') {
    return callback(null, true);
  }

  // Origin absent (curl, serveur à serveur) ou "null" (WebView Android,
  // navigateurs intégrés d'apps, pages file://, contextes opaques) :
  // "null" est produit par le NAVIGATEUR lui-même — un site malveillant
  // envoie toujours son vrai Origin, donc l'accepter ne crée pas de faille.
  // Les vraies protections restent actives : cookie SameSite=Lax, mot de
  // passe système, JWT.
  if (!origin || origin === 'null') {
    return callback(null, true);
  }

  // En production, pas de raccourci localhost : seules les origines exactement
  // listées (ALLOWED_ORIGINS / CORS_ORIGINS) sont acceptées.
  const normalizedOrigin = origin.replace(/\/$/, '');
  const allowedSet = new Set(allowedOrigins);

  if (allowedSet.has(normalizedOrigin)) {
    return callback(null, true);
  }

  const netlifyMatch = allowedOrigins.find((allowed) => {
    if (!allowed.includes('netlify.app')) return false;
    // Comparaison sur l'hôte (sans schéma ni slash final) pour autoriser les sous-domaines
    const allowedHost = allowed.replace(/\/$/, '').replace(/^https?:\/\//i, '').toLowerCase();
    const originHost = normalizedOrigin.replace(/^https?:\/\//i, '').toLowerCase();
    return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`);
  });

  if (netlifyMatch) {
    return callback(null, true);
  }

  logger(`[cors] Origin bloquee: ${origin} | autorisees: ${allowedOrigins.join(', ') || '(aucune)'}`, 'warning');
  return callback(new Error('Origin not allowed by CORS'));
};

const attachRequestLogging = (app) => {
  if (config.NODE_ENV === 'development' || config.LOG_REQUESTS === 'true') {
    app.use(morgan('dev'));
  }

  if (config.LOG_REQUESTS === 'true') {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startedAt;
        const requestId = req.requestId || 'no-request-id';
        let logMessage = `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

        const hasBody =
          req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
        if (hasBody) {
          const safeBody = JSON.stringify(maskSensitiveData(req.body));
          const truncated =
            safeBody.length > 2000 ? `${safeBody.slice(0, 2000)}… [TRUNCATED]` : safeBody;
          logMessage += ` body=${truncated}`;
        }

        logger(logMessage, res.statusCode >= 400 ? 'error' : 'info');
      });
      next();
    });
  }
};

const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  // Avertissement si la production ne permet qu'un fallback localhost (frontends bloqués)
  if (config.NODE_ENV === 'production') {
    const remoteOrigins = allowedOrigins.filter((o) => !/localhost|127\.0\.0\.1/.test(o));
    if (remoteOrigins.length === 0) {
      logger(
        '[cors] ATTENTION: aucune origine distante autorisée en production (fallback localhost uniquement). ' +
        'Définissez ALLOWED_ORIGINS ou CORS_ORIGINS pour autoriser vos frontends.',
        'warning'
      );
    }
  }

  app.set('trust proxy', 1);

  // Compression
  app.use(compression());

  // Session
  app.use(
    session({
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
      },
    })
  );

  // Cookie parser
  app.use(cookieParser());

  // Body parsers
  // ⚠️ verify() capture le raw body AVANT parsing JSON → nécessaire pour vérifier
  //    les signatures HMAC des webhooks (SenePay, Stripe, etc.)
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Middleware: Request ID (tracing distribué) ──
  app.use(requestIdMiddleware());

  // ── Middleware: Versioning API ──
  // Ajoute les headers API-Version, API-Deprecated, API-Sunset
  app.use(apiVersionMiddleware);

  // ── CORS ──
  // Wrapper : les requêtes same-origin (même hôte, ex: POST du formulaire
  // /system/status vers lui-même) sont toujours acceptées — le navigateur ne
  // vérifie pas CORS pour le même hôte. Les requêtes cross-origin passent par
  // la liste blanche stricte (buildCorsOriginHandler).
  const corsHandler = buildCorsOriginHandler(allowedOrigins);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (isSameOrigin(origin, host)) {
      return next();
    }
    return cors({
      origin: corsHandler,
      methods: config.CORS.methods,
      allowedHeaders: config.CORS.allowedHeaders,
      credentials: config.CORS.credentials,
    })(req, res, next);
  });

  // ── Middleware: Validation des entrées ──
  // Nettoie XSS, détecte injections NoSQL/SQL, valide Content-Type
  app.use(inputValidationMiddleware);

  // ── Middleware: Monitoring performance ──
  // Track les temps de réponse, mémoire, endpoints lents
  app.use(performanceMonitor({ slowThreshold: 5000 }));

  // Request logging (morgan + custom)
  attachRequestLogging(app);

  // ── Sécurité (Helmet, rate limiting, sanitize) ──
  setupSecurity(app);

  // ── Web App Trivida (Expo web build) ──
  const trividaWebDir = path.join(__dirname, '../../../trivida-v2/dist');
  if (require('fs').existsSync(trividaWebDir)) {
    app.use(express.static(trividaWebDir));
  }

  // ── Landing Pages (pricing, etc.) ──
  const landingDir = path.join(__dirname, '../../landing');
  app.use(express.static(landingDir));
  app.get('/pricing', (req, res) => {
    res.sendFile(path.join(landingDir, 'pricing.html'));
  });
  app.get('/trivida/privacy', (req, res) => {
    res.sendFile(path.join(landingDir, 'trivida-privacy.html'));
  });

  return { app, allowedOrigins };
};

module.exports = {
  createApp,
  getAllowedOrigins,
  buildCorsOriginHandler,
  isSameOrigin,
};
