const logger = require('../../utils/logging/logger');

class NotificationService {
  constructor() {
    this.io = null;
  }

  init(io) {
    this.io = io;
    logger('NotificationService initialized', 'info');
    
    this.io.on('connection', (socket) => {
      // Logique de connexion de base
      const uid = String(socket.userId || '');
      if (uid) {
        socket.join(uid);
        logger(`Socket connected: ${uid}`, 'debug');
      }

      socket.on('join', (userId) => {
        if (userId && String(userId) === uid) {
          socket.join(uid);
        }
      });
      
      // Typing indicators
      socket.on('typing:start', ({ to }) => {
        if (!to) return;
        this.io.to(String(to)).emit('typing', { from: uid, isTyping: true });
      });

      socket.on('typing:stop', ({ to }) => {
        if (!to) return;
        this.io.to(String(to)).emit('typing', { from: uid, isTyping: false });
      });

      // Hook pour les extensions futures
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    // Méthode à surcharger ou étendre si besoin
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   * @param {string} userId - ID de l'utilisateur
   * @param {string} event - Nom de l'événement
   * @param {object} data - Données à envoyer
   */
  sendToUser(userId, event, data) {
    if (!this.io) {
      logger('NotificationService not initialized (io missing)', 'warning');
      return false;
    }
    this.io.to(String(userId)).emit(event, data);
    return true;
  }

  /**
   * Diffuse une notification à tous les utilisateurs connectés
   * @param {string} event - Nom de l'événement
   * @param {object} data - Données à envoyer
   */
  broadcast(event, data) {
    if (!this.io) {
      logger('NotificationService not initialized (io missing)', 'warning');
      return false;
    }
    this.io.emit(event, data);
    return true;
  }
}

// Singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
