/**
 * Schéma AdminSettings — Paramètres configurables du panel admin
 * 
 * Stocke les paramètres modifiables depuis l'interface admin :
 *   - Prix des plans (basic, premium)
 *   - Configuration messaging
 *   - Seuils d'alerte
 * 
 * Singleton : un seul document dans la collection.
 */
const mongoose = require('mongoose');

const AdminSettingsSchema = new mongoose.Schema({
    // ── Prix des plans (XAF / mois) ──────────────────────────────────────
    planPrices: {
        basic: { type: Number, default: 1500, min: 0 },
        premium: { type: Number, default: 3500, min: 0 },
        currency: { type: String, default: 'XAF' },
    },
    
    // ── Quotas IA ────────────────────────────────────────────────────────
    aiQuotaPerDay: { type: Number, default: 5, min: 1, max: 100 },
    
    // ── Seuils d'alerte ─────────────────────────────────────────────────
    alerts: {
        expiringDaysBefore: { type: Number, default: 7, min: 1, max: 90 },
        lockThreshold: { type: Number, default: 5, min: 1, max: 20 },
    },
    
    // ── Configuration WhatsApp (CallMeBot) ──────────────────────────────
    whatsapp: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' },
        phone: { type: String, default: '' },
    },
    
    // ── Templates de messages ───────────────────────────────────────────
    messageTemplates: {
        subscriptionExpiring: {
            subject: { type: String, default: 'Votre abonnement Trivida expire bientôt' },
            body: { type: String, default: 'Bonjour {name},\n\nVotre abonnement {plan} expire le {expiry}.\nRenouvelez-le pour continuer à profiter de Trivida.\n\nL\'équipe Trivida' },
        },
        subscriptionExpired: {
            subject: { type: String, default: 'Votre abonnement Trivida a expiré' },
            body: { type: String, default: 'Bonjour {name},\n\nVotre abonnement {plan} a expiré.\nPassez à Premium pour accéder à toutes les fonctionnalités.\n\nL\'équipe Trivida' },
        },
        reengagement: {
            subject: { type: String, default: 'Nous vous avons manqué sur Trivida !' },
            body: { type: String, default: 'Bonjour {name},\n\nÇa fait longtemps que vous n\'avez pas utilisé Trivida.\nReconnectez-vous et découvrez les nouveautés !\n\nL\'équipe Trivida' },
        },
        welcome: {
            subject: { type: String, default: 'Bienvenue sur Trivida' },
            body: { type: String, default: 'Bonjour {name},\n\nBienvenue sur Trivida ! Votre compte est prêt.\nCommencez à gérer vos finances dès maintenant.\n\nL\'équipe Trivida' },
        },
    },
}, { 
    timestamps: true, 
    versionKey: false 
});

module.exports = AdminSettingsSchema;
