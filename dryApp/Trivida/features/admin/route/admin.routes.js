/**
 * Routes Admin — Trivida Admin Panel
 * 
 * Deux niveaux d'accès :
 *   - admin : lecture seule (users, stats, logs, export, messagerie)
 *   - superadmin : accès complet (settings, app update, modif users)
 * 
 * Base URL: /api/v1/trivida/admin/
 */
const express = require('express');
const router = express.Router();

const {
    adminLogin,
    getUsers,
    getUserById,
    updateUserStatus,
    updateUserPlan,
    getOverview,
    seedAdmins,
    getGrowth,
    getSyncStats,
    getAIStats,
    getAIHistory,
    getMetricsHistory,
    getRevenueStats,
    getEntityStats,
    getAdminLogs,
    getAppUpdate,
    updateAppManifest,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    exportUsers,
    exportStats,
    exportMetrics,
    getSettings,
    updateSettings,
    sendMessage,
    getMessageTemplates,
    getPerformanceDashboard,
    getUsersEnriched,
    getIntelOverview,
    getIntelProfiles,
    getIntelHealth,
} = require('../controller/admin.controller');

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { withAudit } = require('../../../../../dry/middlewares/audit');

// ─── AUTHENTIFICATION ─────────────────────────────────────────────────────────
router.post('/login', adminLogin);

// ─── SEED ADMINS (temporaire, protégé par secret) ─────────────────────────
router.post('/seed-admins', seedAdmins);

// ─── ROUTES ADMIN (admin + superadmin) ──────────────────────────────────────

// Utilisateurs (lecture)
router.get('/users/enriched', protect, requireSuperAdmin(), withAudit('ADMIN_GET_USERS_ENRICHED'), getUsersEnriched);
router.get('/users', protect, requireSuperAdmin(), withAudit('ADMIN_GET_USERS'), getUsers);
router.get('/users/:id', protect, requireSuperAdmin(), withAudit('ADMIN_GET_USER'), getUserById);

// Statistiques
router.get('/stats/overview', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_OVERVIEW'), getOverview);
router.get('/stats/growth', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_GROWTH'), getGrowth);
router.get('/stats/sync', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_SYNC'), getSyncStats);
router.get('/stats/ai', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_AI'), getAIStats);
router.get('/stats/ai/history', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_AI_HISTORY'), getAIHistory);
router.get('/stats/metrics/history', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_METRICS_HISTORY'), getMetricsHistory);
router.get('/stats/revenue', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_REVENUE'), getRevenueStats);
router.get('/stats/entities', protect, requireSuperAdmin(), withAudit('ADMIN_STATS_ENTITIES'), getEntityStats);

// Notifications
router.get('/notifications', protect, requireSuperAdmin(), withAudit('ADMIN_GET_NOTIFICATIONS'), getNotifications);
router.patch('/notifications/:id/read', protect, requireSuperAdmin(), withAudit('ADMIN_READ_NOTIFICATION'), markNotificationRead);
router.patch('/notifications/read-all', protect, requireSuperAdmin(), withAudit('ADMIN_READ_ALL_NOTIFICATIONS'), markAllNotificationsRead);

// Export
router.get('/export/users', protect, requireSuperAdmin(), withAudit('ADMIN_EXPORT_USERS'), exportUsers);
router.get('/export/stats', protect, requireSuperAdmin(), withAudit('ADMIN_EXPORT_STATS'), exportStats);
router.get('/export/metrics', protect, requireSuperAdmin(), withAudit('ADMIN_EXPORT_METRICS'), exportMetrics);

// Messagerie
router.post('/messaging/send', protect, requireSuperAdmin(), withAudit('ADMIN_SEND_MESSAGE'), sendMessage);
router.get('/messaging/templates', protect, requireSuperAdmin(), withAudit('ADMIN_GET_TEMPLATES'), getMessageTemplates);

// Performance
router.get('/performance/dashboard', protect, requireSuperAdmin(), withAudit('ADMIN_PERF_DASHBOARD'), getPerformanceDashboard);

// Intel
router.get('/intel/overview', protect, requireSuperAdmin(), withAudit('ADMIN_INTEL_OVERVIEW'), getIntelOverview);
router.get('/intel/profiles', protect, requireSuperAdmin(), withAudit('ADMIN_INTEL_PROFILES'), getIntelProfiles);
router.get('/intel/health', protect, requireSuperAdmin(), withAudit('ADMIN_INTEL_HEALTH'), getIntelHealth);

// Journal d'audit
router.get('/logs', protect, requireSuperAdmin(), withAudit('ADMIN_GET_LOGS'), getAdminLogs);

// ─── ROUTES SUPERADMIN UNIQUEMENT ──────────────────────────────────────────

// Modification d'utilisateurs (changement statut/plan)
router.patch('/users/:id/status', protect, requireSuperAdmin(true), withAudit('ADMIN_UPDATE_STATUS'), updateUserStatus);
router.patch('/users/:id/plan', protect, requireSuperAdmin(true), withAudit('ADMIN_UPDATE_PLAN'), updateUserPlan);

// Paramètres (prix, quotas, config)
router.get('/settings', protect, requireSuperAdmin(true), withAudit('ADMIN_GET_SETTINGS'), getSettings);
router.patch('/settings', protect, requireSuperAdmin(true), withAudit('ADMIN_UPDATE_SETTINGS'), updateSettings);

// App Update
router.get('/app/update', protect, requireSuperAdmin(true), withAudit('ADMIN_GET_UPDATE'), getAppUpdate);
router.patch('/app/update', protect, requireSuperAdmin(true), withAudit('ADMIN_UPDATE_APP'), updateAppManifest);

module.exports = router;
