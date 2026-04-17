const { Server: SocketIOServer } = require('socket.io');

const config = require('../../config/database');
const { verifyToken } = require('../utils/auth/jwt.util');
const notificationService = require('../services/notification/notification.service');

const buildSocketOriginHandler = (allowedOrigins) => (origin, callback) => {
  if (config.NODE_ENV !== 'production') {
    return callback(null, true);
  }

  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Origin not allowed by CORS'));
};

const createSocketServer = (server, app, allowedOrigins) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: buildSocketOriginHandler(allowedOrigins),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  });

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
    } catch {
      return next(new Error('Non autorise : token invalide ou expire'));
    }
  });

  notificationService.init(io);
  app.set('io', io);

  return io;
};

module.exports = {
  createSocketServer,
};
