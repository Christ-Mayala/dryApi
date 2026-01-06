require('dotenv').config();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./dry/utils/logger');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const sendResponse = require('./dry/utils/response');
const { verifyToken } = require('./dry/utils/jwt');

const { connectCluster } = require('./dry/config/connection/dbConnection');
const bootstrapApps = require('./dry/core/bootloader');
const setupSecurity = require('./dry/middlewares/protection/security.middleware');
const errorHandler = require('./dry/middlewares/error/errorHandler');
const { startPurgeScheduler } = require('./dry/services/cleanup/purgeDeleted.scheduler');

const app = express();

// ✅ Dire à Express de faire confiance aux proxies (Render / Netlify / Heroku)
app.set('trust proxy', 1); // 1 proxy unique

// Limiteur de requêtes global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: 'Trop de requêtes venant de cette IP, réessayez plus tard.',
});

app.use(limiter);

app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration CORS stricte et réutilisable
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins = allowedOriginsEnv.split(',').map((o) => o.trim());

app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
);

if (process.env.NODE_ENV === 'development' || process.env.LOG_REQUESTS === 'true') {
  app.use(morgan('dev'));
}

if (process.env.LOG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`;
      logger(line, res.statusCode >= 400 ? 'error' : 'info');
    });
    next();
  });
}

// Sécurité HTTP + nettoyage des entrées (XSS / NoSQL injection)
setupSecurity(app);

// Chargement automatique des apps (multi-tenant DRY)
bootstrapApps(app);

// Endpoint de health-check minimal
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DRY Multi-Tenant Server Running',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  return sendResponse(res, null, 'Route introuvable', false);
});

// Gestion centralisée des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

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

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers?.authorization;
    const bearer = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = authToken || bearer || socket.handshake.query?.token;

    if (!token) return next(new Error('Non autorisé'));

    const decoded = verifyToken(token);
    socket.userId = decoded?.id;
    if (!socket.userId) return next(new Error('Non autorisé'));

    return next();
  } catch (e) {
    return next(new Error('Non autorisé'));
  }
});

io.on('connection', (socket) => {
  const uid = String(socket.userId || '');
  if (uid) socket.join(uid);

  socket.on('join', (userId) => {
    if (userId && String(userId) === uid) socket.join(uid);
  });

  socket.on('typing:start', ({ to } = {}) => {
    if (!to) return;
    io.to(String(to)).emit('typing', { from: uid, isTyping: true });
  });

  socket.on('typing:stop', ({ to } = {}) => {
    if (!to) return;
    io.to(String(to)).emit('typing', { from: uid, isTyping: false });
  });
});

app.set('io', io);

(async () => {
  await connectCluster();

  startPurgeScheduler();

  server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`✅ SERVEUR LANCÉ SUR LE PORT : ${PORT}`);
    console.log(`📂 STRUCTURE DRY ACTIVÉE`);
    console.log(`🌍 CORS Origins: ${allowedOriginsEnv}`);
    console.log(`=========================================\n`);
  });
})().catch((err) => {
  console.error('❌ Échec au démarrage:', err?.message || err);
  process.exit(1);
});