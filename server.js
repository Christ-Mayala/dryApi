require('dotenv').config();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { connectCluster } = require('./dry/config/connection/dbConnection');
const bootstrapApps = require('./dry/core/bootloader');
const errorHandler = require('./dry/middlewares/error/errorHandler');
const { startPurgeScheduler } = require('./dry/services/cleanup/purgeDeleted.scheduler');
const { protect, authorize } = require('./dry/middlewares/protection/auth.middleware');
const setupSecurity = require('./dry/middlewares/protection/security.middleware');
const logger = require('./dry/utils/logger');
const sendResponse = require('./dry/utils/response');

// Initialisation de l'application Express
const app = express();

// ✅ Configuration de confiance pour les proxies (Render/Netlify/Heroku)
app.set('trust proxy', 1);

// ✅ Middleware pour les cookies (avec options sécurisées)
app.use(cookieParser());

// ✅ Limite la taille des requêtes JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Configuration CORS stricte
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'], // Ajout de CSRF-Token
      credentials: true,
    })
);

// ✅ Logging des requêtes (uniquement en développement ou si activé)
if (process.env.NODE_ENV === 'development' || process.env.LOG_REQUESTS === 'true') {
  app.use(morgan('dev'));
}

// ✅ Logging personnalisé des requêtes
if (process.env.LOG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
      logger(logMessage, res.statusCode >= 400 ? 'error' : 'info');
    });
    next();
  });
}

// ✅ Sécurité HTTP (Helmet, XSS, NoSQL Injection)
setupSecurity(app);

// ✅ Middleware CSRF (appliqué uniquement aux routes API sensibles)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

// Middleware pour exposer le token CSRF aux clients
const exposeCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

// // ✅ Appliquer csrfProtection à toutes les routes sous /api (pour initialiser req.csrfToken)
// app.use('/api', csrfProtection);
//
// // ✅ Exposer le token CSRF pour toutes les routes sous /api
// app.use('/api', exposeCsrfToken);
//
// // ✅ Appliquer la vérification CSRF uniquement aux méthodes non-safe
// app.use('/api', (req, res, next) => {
//   if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
//     return next(); // Ne vérifie pas le token CSRF pour les méthodes safe
//   }
//   // Le token CSRF est déjà vérifié par csrfProtection, donc pas besoin de le refaire ici
//   next();
// });


// ✅ Chargement automatique des applications (multi-tenant DRY)
bootstrapApps(app);

// ✅ Route de health-check (exclue de CSRF)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DRY Multi-Tenant Server Running',
    timestamp: new Date().toISOString(),
  });
});

// ✅ Gestion des routes non trouvées
app.use((req, res) => {
  return sendResponse(res, null, 'Route introuvable', false);
});

// ✅ Gestion centralisée des erreurs
app.use(errorHandler);

// ✅ Initialisation du serveur HTTP
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ✅ Configuration de Socket.IO (avec CORS et authentification)
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

// ✅ Middleware d'authentification Socket.IO
io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers?.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
    const token = authToken || bearer || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Non autorisé : token manquant'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return next(new Error('Non autorisé : token invalide'));
    }

    socket.userId = decoded.id;
    return next();
  } catch (error) {
    return next(new Error('Non autorisé : token invalide ou expiré'));
  }
});

// ✅ Gestion des événements Socket.IO
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

// ✅ Attache io à l'application Express pour utilisation dans les routes
app.set('io', io);

// ✅ Démarrage du serveur
(async () => {
  try {
    await connectCluster();
    startPurgeScheduler();

    server.listen(PORT, () => {
      console.log(`\n=========================================`);
      console.log(`✅ SERVEUR LANCÉ SUR LE PORT : ${PORT}`);
      console.log(`📂 STRUCTURE DRY ACTIVÉE`);
      console.log(`🌍 CORS Origins: ${allowedOriginsEnv || 'Aucun (désactivé)'}`);
      console.log(`🔒 CSRF Protection: Activée pour /api`);
      console.log(`=========================================\n`);
    });
  } catch (error) {
    console.error('❌ Échec au démarrage du serveur :', error.message);
    process.exit(1);
  }
})();
