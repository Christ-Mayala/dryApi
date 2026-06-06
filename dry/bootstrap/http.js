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
const setupSecurity = require('../middlewares/protection/security.middleware');

// Nouveaux middlewares (Phase 2, 3)
const { requestIdMiddleware } = require('../middlewares/requestId.middleware');
const { apiVersionMiddleware } = require('../middlewares/apiVersion.middleware');
const { inputValidationMiddleware } = require('../middlewares/inputValidation.middleware');
const { performanceMonitor } = require('../middlewares/performanceMonitor.middleware');

const getAllowedOrigins = () => {
  const allowedOrigins = (config.ALLOWED_ORIGINS || '')
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

const buildCorsOriginHandler = (allowedOrigins) => (origin, callback) => {
  if (config.NODE_ENV !== 'production') {
    return callback(null, true);
  }

  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }

  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  logger(`[cors] Origin bloquee: ${origin}`, 'warning');
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
        const logMessage = `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
        logger(logMessage, res.statusCode >= 400 ? 'error' : 'info');
      });
      next();
    });
  }
};

const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

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
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Middleware: Request ID (tracing distribué) ──
  app.use(requestIdMiddleware());

  // ── Middleware: Versioning API ──
  // Ajoute les headers API-Version, API-Deprecated, API-Sunset
  app.use(apiVersionMiddleware);

  // ── CORS ──
  app.use(
    cors({
      origin: buildCorsOriginHandler(allowedOrigins),
      methods: config.CORS.methods,
      allowedHeaders: config.CORS.allowedHeaders,
      credentials: config.CORS.credentials,
    })
  );

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

  // ── Landing Pages (pricing, etc.) ──
  const landingDir = path.join(__dirname, '../../landing');
  app.get(['/pricing', '/pricing.html'], (req, res) => {
    res.sendFile(path.join(landingDir, 'pricing.html'));
  });

  return { app, allowedOrigins };
};

module.exports = {
  createApp,
  getAllowedOrigins,
  buildCorsOriginHandler,
};
