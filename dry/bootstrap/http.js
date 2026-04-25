const express = require('express');
const compression = require('compression');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');

const config = require('../../config/database');
const logger = require('../utils/logging/logger');
const setupSecurity = require('../middlewares/protection/security.middleware');

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

  app.use(compression());

  app.use(
    session({
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      // Passport OAuth (Google/Facebook) utilise la session pour stocker l'état.
      // `sameSite: 'lax'` permet le retour de provider -> callback sur navigation top-level.
      cookie: {
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
      },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use((req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  app.use(
    cors({
      origin: buildCorsOriginHandler(allowedOrigins),
      methods: config.CORS.methods,
      allowedHeaders: config.CORS.allowedHeaders,
      credentials: config.CORS.credentials,
    })
  );

  attachRequestLogging(app);
  setupSecurity(app);

  return { app, allowedOrigins };
};

module.exports = {
  createApp,
  getAllowedOrigins,
  buildCorsOriginHandler,
};
