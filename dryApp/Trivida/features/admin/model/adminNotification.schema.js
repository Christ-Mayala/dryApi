/**
 * Schéma AdminNotification — Notifications in-app du panel admin
 * 
 * Système de notifications pour les alertes admin :
 *   - Nouvel utilisateur inscrit
 *   - Quota IA atteint
 *   - Abonnement expiré
 *   - Erreur de sync critique
 *   - Changement de plan
 * 
 * Le frontend poll / Socket.IO récupère les notifications non lues.
 */
const mongoose = require('mongoose');

const AdminNotificationSchema = new mongoose.Schema({
    type: { 
        type: String, 
        required: true,
        enum: [
            'new_user',
            'user_locked',
            'quota_reached',
            'subscription_expiring',
            'subscription_expired',
            'sync_error',
            'plan_changed',
            'user_deleted',
            'app_update',
            'system_alert',
        ],
        index: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    
    // Données contextuelles (flexibles)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Cible (null = toutes les admins)
    targetAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // Statut de lecture
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    
    // Niveau de sévérité
    severity: { 
        type: String, 
        enum: ['info', 'warning', 'critical'], 
        default: 'info' 
    },
}, { 
    timestamps: true, 
    versionKey: false 
});

// Index composés pour les requêtes fréquentes
AdminNotificationSchema.index({ read: 1, createdAt: -1 });
AdminNotificationSchema.index({ type: 1, read: 1 });

module.exports = AdminNotificationSchema;
