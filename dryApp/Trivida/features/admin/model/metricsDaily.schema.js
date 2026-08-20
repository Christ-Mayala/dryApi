/**
 * Schéma MetricsDaily — Snapshots de métriques quotidiennes Trivida
 * 
 * Calculé chaque jour à minuit par le cron job adminMetricsCron.
 * Permet d'afficher l'historique des KPIs dans le panel admin
 * sans recalculer à chaque fois (performance).
 * 
 * Chaque document = un jour complet de métriques.
 */
const mongoose = require('mongoose');

const MetricsDailySchema = new mongoose.Schema({
    date: { 
        type: Date, 
        required: true, 
        unique: true,
        index: true 
    },
    
    // ── Utilisateurs ────────────────────────────────────────────────────────
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    premiumUsers: { type: Number, default: 0 },
    basicUsers: { type: Number, default: 0 },
    freeUsers: { type: Number, default: 0 },
    deletedUsers: { type: Number, default: 0 },
    lockedUsers: { type: Number, default: 0 },
    
    // ── Synchronisation ─────────────────────────────────────────────────────
    usersSyncedToday: { type: Number, default: 0 },
    totalDeviceIds: { type: Number, default: 0 },
    
    // ── IA ──────────────────────────────────────────────────────────────────
    totalAIRequests: { type: Number, default: 0 },
    usersWithAIRequests: { type: Number, default: 0 },
    usersQuotaReached: { type: Number, default: 0 },
    
    // ── Entités métier ──────────────────────────────────────────────────────
    totalTransactions: { type: Number, default: 0 },
    totalCustomers: { type: Number, default: 0 },
    totalActivities: { type: Number, default: 0 },
    totalDebts: { type: Number, default: 0 },
    totalSavingsGoals: { type: Number, default: 0 },
    totalInvoices: { type: Number, default: 0 },
    totalStocks: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    totalBusinessProfiles: { type: Number, default: 0 },
    
    // ── Revenus ─────────────────────────────────────────────────────────────
    estimatedMonthlyRevenue: { type: Number, default: 0 },
    expiringIn7Days: { type: Number, default: 0 },
    
    // ── Métadonnées ─────────────────────────────────────────────────────────
    calculatedAt: { type: Date, default: Date.now },
}, { 
    timestamps: true, 
    versionKey: false 
});

MetricsDailySchema.index({ date: -1 });

module.exports = MetricsDailySchema;
