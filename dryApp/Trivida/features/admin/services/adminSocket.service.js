/**
 * Service Socket.IO — Notifications temps réel admin Trivida
 * 
 * Gère les connections WebSocket des administrateurs connectés au panel.
 * Permet d'envoyer des notifications en temps réel :
 *   - Nouvel utilisateur inscrit
 *   - Quota IA atteint
 *   - Abonnement expirant
 *   - Erreur de sync critique
 * 
 * Protocole :
 *   1. L'admin se connecte avec le token JWT
 *   2. Le serveur vérifie le rôle superadmin
 *   3. L'admin rejoint la room 'admins'
 *   4. Les notifications sont broadcastées à tous les admins connectés
 */
const { Server } = require('socket.io');
const { verifyToken } = require('../../../../../dry/utils/auth/jwt.util');
const getModel = require('../../../../../dry/core/factories/modelFactory');
const AdminNotificationSchema = require('../model/adminNotification.schema.js');

const APP_NAME = 'Trivida';

// Instance Socket.IO (initialisée une fois)
let io = null;
const connectedAdmins = new Map(); // socketId → { userId, email, connectedAt }

/**
 * Initialiser le serveur Socket.IO sur le serveur HTTP existant
 * @param {http.Server} httpServer - Le serveur HTTP Express
 * @returns {Server} L'instance Socket.IO
 */
function initAdminSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5174', 'http://localhost:5000'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        path: '/admin/socket.io',
        transports: ['websocket', 'polling'],
    });
    
    // ── Middleware d'authentification ────────────────────────────────────────
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            
            if (!token) {
                return next(new Error('Token requis'));
            }
            
            const decoded = verifyToken(token);
            
            // Vérifier que l'utilisateur est un superadmin
            let User;
            try {
                User = getModel(APP_NAME, 'User');
            } catch (e) {
                return next(new Error('Erreur serveur'));
            }
            
            const user = await User.findById(decoded.id).select('role email name status');
            
            if (!user || user.role !== 'superadmin') {
                return next(new Error('Accès réservé aux super administrateurs'));
            }
            
            if (user.status === 'deleted' || user.status === 'banned') {
                return next(new Error('Compte désactivé'));
            }
            
            socket.admin = {
                userId: user._id.toString(),
                email: user.email,
                name: user.name,
            };
            
            next();
        } catch (error) {
            next(new Error('Token invalide'));
        }
    });
    
    // ── Gestion des connections ──────────────────────────────────────────────
    io.on('connection', (socket) => {
        const adminInfo = socket.admin;
        connectedAdmins.set(socket.id, {
            ...adminInfo,
            connectedAt: new Date(),
        });
        
        console.log(`🔌 [AdminSocket] ${adminInfo.email} connecté (${connectedAdmins.size} admin(s) en ligne)`);
        
        // Rejoindre la room 'admins'
        socket.join('admins');
        
        // Envoyer le nombre d'admins en ligne
        io.to('admins').emit('admins:count', connectedAdmins.size);
        
        // ── Événements ──────────────────────────────────────────────────────
        
        // Demander les notifications non lues
        socket.on('notifications:unread', async (callback) => {
            try {
                const AdminNotification = getModel(APP_NAME, 'TrividaAdminNotification', AdminNotificationSchema);
                const notifications = await AdminNotification.find({ read: false })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .lean();
                
                const count = await AdminNotification.countDocuments({ read: false });
                
                callback({ success: true, notifications, count });
            } catch (error) {
                callback({ success: false, error: error.message });
            }
        });
        
        // Marquer une notification comme lue
        socket.on('notifications:markRead', async (notificationId, callback) => {
            try {
                const AdminNotification = getModel(APP_NAME, 'TrividaAdminNotification', AdminNotificationSchema);
                await AdminNotification.findByIdAndUpdate(notificationId, {
                    read: true,
                    readAt: new Date(),
                });
                
                callback({ success: true });
                
                // Envoyer la mise à jour du compteur à tous les admins
                const count = await AdminNotification.countDocuments({ read: false });
                io.to('admins').emit('notifications:count', count);
            } catch (error) {
                callback({ success: false, error: error.message });
            }
        });
        
        // Marquer toutes les notifications comme lues
        socket.on('notifications:markAllRead', async (callback) => {
            try {
                const AdminNotification = getModel(APP_NAME, 'TrividaAdminNotification', AdminNotificationSchema);
                await AdminNotification.updateMany(
                    { read: false },
                    { $set: { read: true, readAt: new Date() } }
                );
                
                callback({ success: true });
                io.to('admins').emit('notifications:count', 0);
            } catch (error) {
                callback({ success: false, error: error.message });
            }
        });
        
        // Demander le refresh des stats en temps réel
        socket.on('stats:refresh', async (callback) => {
            try {
                const User = getModel(APP_NAME, 'User');
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const [activeToday, totalUsers, newToday] = await Promise.all([
                    User.countDocuments({ lastLogin: { $gte: today } }),
                    User.countDocuments({}),
                    User.countDocuments({ createdAt: { $gte: today } }),
                ]);
                
                callback({ success: true, stats: { activeToday, totalUsers, newToday } });
            } catch (error) {
                callback({ success: false, error: error.message });
            }
        });
        
        // Déconnexion
        socket.on('disconnect', () => {
            connectedAdmins.delete(socket.id);
            console.log(`🔌 [AdminSocket] ${adminInfo.email} déconnecté (${connectedAdmins.size} admin(s) en ligne)`);
            io.to('admins').emit('admins:count', connectedAdmins.size);
        });
    });
    
    return io;
}

/**
 * Créer une notification et la diffuser aux admins en temps réel
 * @param {Object} params
 * @param {string} params.type - Type de notification
 * @param {string} params.title - Titre court
 * @param {string} params.message - Description
 * @param {Object} [params.meta] - Données contextuelles
 * @param {string} [params.severity] - 'info' | 'warning' | 'critical'
 */
async function createAndBroadcastNotification({ type, title, message, meta = {}, severity = 'info' }) {
    try {
        // Sauvegarder en base
        const AdminNotification = getModel(APP_NAME, 'TrividaAdminNotification', AdminNotificationSchema);
        const notification = await AdminNotification.create({
            type,
            title,
            message,
            meta,
            severity,
        });
        
        // Diffuser via Socket.IO si connecté
        if (io) {
            io.to('admins').emit('notification:new', notification.toObject());
            
            // Mettre à jour le compteur
            const count = await AdminNotification.countDocuments({ read: false });
            io.to('admins').emit('notifications:count', count);
        }
        
        return notification;
    } catch (error) {
        console.error(`[AdminSocket] Erreur création notification:`, error.message);
    }
}

/**
 * Obtenir le nombre d'admins connectés
 */
function getConnectedAdminsCount() {
    return connectedAdmins.size;
}

/**
 * Obtenir l'instance Socket.IO
 */
function getIO() {
    return io;
}

module.exports = { 
    initAdminSocket, 
    createAndBroadcastNotification,
    getConnectedAdminsCount,
    getIO,
};
