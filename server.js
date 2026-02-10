require('dotenv').config();
const http = require('http');
const { randomUUID } = require('crypto');
const { Server: SocketIOServer } = require('socket.io');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { verifyToken } = require('./dry/utils/auth/jwt.util');
const { connectCluster } = require('./dry/config/connection/dbConnection');
const bootstrapApps = require('./dry/core/application/bootloader');
const errorHandler = require('./dry/middlewares/error/errorHandler');
const { startPurgeScheduler } = require('./dry/services/cleanup/purgeDeleted.scheduler');
const { protect, authorize } = require('./dry/middlewares/protection/auth.middleware');
const setupSecurity = require('./dry/middlewares/protection/security.middleware');
const { applyCsrfSelectively, handleCsrfError } = require('./dry/middlewares/protection/csrf.middleware');
const logger = require('./dry/utils/logging/logger');
const sendResponse = require('./dry/utils/http/response');
const redisService = require('./dry/services/cache/redis.service');
const healthService = require('./dry/services/health/health.service');
const { sendAlert } = require('./dry/services/alert/alert.service');
const { swaggerUiMiddleware, swaggerUiSetup, generateSwaggerRoutes } = require('./dry/utils/documentation/swagger.util');

// Initialisation de l'application Express
const app = express();

// Configuration de confiance pour les proxies (Render/Netlify/Heroku)
app.set('trust proxy', 1);

// Middleware pour les cookies (avec options securisees)
app.use(cookieParser());

// Limite la taille des requetes JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// RequestId global (trace prod)
app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Configuration CORS stricte
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Ajouter localhost pour Swagger UI et autoriser toutes les origines en developpement
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4200', 'http://127.0.0.1:4200');
  // Autoriser toutes les origines en developpement pour Swagger
  allowedOrigins.push('*');
}

// En production, on retire le wildcard pour une CORS stricte
if (process.env.NODE_ENV === 'production') {
  const filtered = allowedOrigins.filter((o) => o !== '*');
  allowedOrigins.length = 0;
  allowedOrigins.push(...filtered);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser toutes les origines pour le developpement
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // Autoriser localhost en toutes circonstances
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      // En production, verifier les origines autorisees
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('Origin bloquee:', origin);
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
    credentials: true,
  })
);

// Logging des requetes (uniquement en developpement ou si active)
if (process.env.NODE_ENV === 'development' || process.env.LOG_REQUESTS === 'true') {
  app.use(morgan('dev'));
}

// Logging personnalise des requetes
if (process.env.LOG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const rid = req.requestId || 'no-request-id';
      const logMessage = `[${rid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
      logger(logMessage, res.statusCode >= 400 ? 'error' : 'info');
    });
    next();
  });
}

// Securite HTTP (Helmet, XSS, NoSQL Injection)
setupSecurity(app);

// Middleware CSRF selectif (applique uniquement aux routes sensibles)
// app.use('/api', ...applyCsrfSelectively); // Desactive pour permettre au frontend de communiquer

// Middleware pour exposer le token CSRF aux clients (routes publiques)
// app.get('/api/csrf-token', (req, res) => {
//   res.json({ csrfToken: req.csrfToken() });
// });

// Chargement automatique des applications (multi-tenant DRY)
console.log('\n[BOOT] CHARGEMENT DES APPLICATIONS...\n');
bootstrapApps(app);

// Route de health-check (exclue de CSRF)
app.get('/', async (req, res) => {
  try {
    const health = await healthService.getHealthStatus();
    const statusCode = health.status === 'OK' ? 200 : 503;
    res.status(statusCode).json({
      success: health.status === 'OK',
      message: 'DRY Multi-Tenant Server Running',
      ...health,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
    });
  }
});

// Health checks detailles pour Kubernetes/Docker
app.get('/health/live', async (req, res) => {
  const liveness = await healthService.getLiveness();
  res.status(200).json(liveness);
});

app.get('/health/ready', async (req, res) => {
  const readiness = await healthService.getReadiness();
  const statusCode = readiness.status === 'READY' ? 200 : 503;
  res.status(statusCode).json(readiness);
});

// Generation des routes Swagger au demarrage (une seule fois)
console.log('\n[SWAGGER] GENERATION DOCUMENTATION...\n');
const swaggerSpecs = generateSwaggerRoutes();

// Documentation Swagger
/**
 * @swagger
 * /api-docs:
 *   get:
 *     summary: Documentation API Swagger
 *     description: Acces a la documentation interactive de l'API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Page de documentation Swagger
 */
app.use('/api-docs', swaggerUiMiddleware, swaggerUiSetup);

// Endpoint JSON pour les specs Swagger (pour les outils)
/**
 * @swagger
 * /api-docs.json:
 *   get:
 *     summary: Recuperer les specifications OpenAPI JSON
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Specifications OpenAPI JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Gestion des routes non trouvees
app.use((req, res) => {
  return sendResponse(res, null, 'Route introuvable', false);
});

// Gestion centralisee des erreurs
app.use(handleCsrfError);
app.use(errorHandler);

// Initialisation du serveur HTTP
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Configuration de Socket.IO (avec CORS et authentification)
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
});

// Middleware d'authentification Socket.IO
io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers?.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
    const token = authToken || bearer || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Non autorise : token manquant'));
    }

    const decoded = verifyToken(token);
    if (!decoded?.id) {
      return next(new Error('Non autorise : token invalide'));
    }

    socket.userId = decoded.id;
    return next();
  } catch (error) {
    return next(new Error('Non autorise : token invalide ou expire'));
  }
});

// Gestion des evenements Socket.IO
io.on('connection', (socket) => {
  const uid = String(socket.userId || '');
  if (uid) socket.join(uid);

  socket.on('join', (userId) => {
    if (userId && String(userId) === uid) {
      socket.join(uid);
    }
  });

  socket.on('typing:start', ({ to }) => {
    if (!to) return;
    io.to(String(to)).emit('typing', { from: uid, isTyping: true });
  });

  socket.on('typing:stop', ({ to }) => {
    if (!to) return;
    io.to(String(to)).emit('typing', { from: uid, isTyping: false });
  });
});

// Attache io a l'application Express pour utilisation dans les routes
app.set('io', io);

// Verif secrets forts (JWT)
const validateSecrets = () => {
  const jwtSecret = process.env.JWT_SECRET || '';
  const isProd = process.env.NODE_ENV === 'production';
  if (!jwtSecret || jwtSecret.length < 32) {
    const msg = 'JWT_SECRET manquant ou trop faible (>= 32 caracteres recommande).';
    if (isProd) {
      throw new Error(msg);
    } else {
      logger(msg, 'warning');
    }
  }
};

const startHealthMonitor = () => {
  const intervalMs = Number(process.env.HEALTH_MONITOR_INTERVAL_MS || 0);
  if (!intervalMs || intervalMs < 10000) return;

  const repeatAlerts = String(process.env.MONITOR_REPEAT_ALERTS || 'false').toLowerCase() === 'true';
  const repeatMs = Number(process.env.MONITOR_REPEAT_ALERT_MS || 900000);

  let lastStatus = null;
  let lastAlertAt = 0;
  let lastErrorAt = 0;
  let outageStart = null;
  let outageReported = false;

  setInterval(async () => {
    try {
      const health = await healthService.getHealthStatus();
      const status = health.status;
      const now = Date.now();

      if (status !== 'OK') {
        if (!outageStart) outageStart = now;

        const shouldSend = !outageReported || (repeatAlerts && now - lastAlertAt >= repeatMs);
        if (shouldSend) {
          const downtimeSeconds = Math.floor((now - outageStart) / 1000);
          const msg = `[monitor] status=${status} db=${health.services?.database?.status} redis=${health.services?.redis?.connected ? 'UP' : 'DOWN'}`;
          logger(msg, 'warning');
          await sendAlert({
            event: 'DRY_HEALTH_ALERT',
            status,
            timestamp: new Date().toISOString(),
            details: health.services,
            downtimeSeconds,
            downtimeStart: new Date(outageStart).toISOString(),
          });
          outageReported = true;
          lastAlertAt = now;
        }
      } else {
        if (lastStatus && lastStatus !== 'OK') {
          const downtimeSeconds = outageStart ? Math.floor((now - outageStart) / 1000) : 0;
          await sendAlert({
            event: 'DRY_HEALTH_RECOVERED',
            status: 'OK',
            timestamp: new Date().toISOString(),
            details: health.services,
            downtimeSeconds,
            downtimeStart: outageStart ? new Date(outageStart).toISOString() : undefined,
            downtimeEnd: new Date().toISOString(),
          });
        }
        outageStart = null;
        outageReported = false;
        lastAlertAt = 0;
      }

      lastStatus = status;
    } catch (e) {
      logger(`[monitor] error: ${e.message}`, 'error');
      const now = Date.now();
      const shouldSendError = !lastErrorAt || (repeatAlerts && now - lastErrorAt >= repeatMs);
      if (shouldSendError) {
        await sendAlert({
          event: 'DRY_HEALTH_ERROR',
          error: e.message,
          timestamp: new Date().toISOString(),
        });
        lastErrorAt = now;
      }
    }
  }, intervalMs);
};

// Demarrage du serveur
(async () => {
  try {
    validateSecrets();
    await connectCluster();

    // Connexion a Redis (optionnel)
    await redisService.connect();

    startPurgeScheduler();
    startHealthMonitor();

    server.listen(PORT, () => {
      console.log(`\n=========================================`);
      console.log(`OK SERVEUR LANCE SUR LE PORT : ${PORT}`);
      console.log(`STRUCTURE DRY ACTIVEE`);
      console.log(`CORS Origins: ${allowedOriginsEnv || 'Aucun (desactive)'}`);
      console.log(`CSRF Protection: Activee pour routes sensibles`);
      console.log(`Cache Redis: ${redisService.getStatus().connected ? 'Active' : 'Desactive'}`);
      console.log(`Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`=========================================\n`);
    });
  } catch (error) {
    console.error('ECHEC AU DEMARRAGE DU SERVEUR :', error.message);
    process.exit(1);
  }
})();
