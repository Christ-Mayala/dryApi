/**
 * Schéma AdminLog — Journal d'audit des actions administrateur
 * 
 * Enregistre chaque action effectuée par un superadmin dans le panel.
 * Utilisé pour la traçabilité et la sécurité.
 * 
 * Entités : User, Transaction, Debt, Savings, Invoice, etc.
 * Actions : user_update, user_delete, plan_change, status_change, app_update, etc.
 */
const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    adminEmail: { type: String, required: true },
    action: { 
        type: String, 
        required: true,
        enum: [
            'user_status_change',
            'user_plan_change', 
            'user_delete',
            'user_restore',
            'user_update',
            'app_update_manifest',
            'admin_login',
            'stats_export',
            'message_sent',
            'settings_updated',
        ],
        index: true
    },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, index: true },
    targetUserEmail: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
}, { 
    timestamps: true, 
    versionKey: false 
});

// Index composés pour les requêtes fréquentes
AdminLogSchema.index({ adminId: 1, createdAt: -1 });
AdminLogSchema.index({ action: 1, createdAt: -1 });

module.exports = AdminLogSchema;
