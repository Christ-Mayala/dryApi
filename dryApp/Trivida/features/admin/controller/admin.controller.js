/**
 * Admin Controller — Trivida Admin Panel
 * 
 * Tous les endpoints du panel d'administration Trivida.
 * Protégés par protect + requireSuperAdmin.
 * 
 * Endpoints :
 *   POST /admin/login          → Authentification admin (JWT classique)
 *   GET  /admin/users           → Liste paginée des utilisateurs
 *   GET  /admin/users/:id       → Détail complet d'un utilisateur
 *   PATCH /admin/users/:id/status → Activer / suspendre / supprimer
 *   PATCH /admin/users/:id/plan   → Changer le plan premium
 *   GET  /admin/stats/overview    → KPIs globaux
 *   GET  /admin/stats/growth      → Courbe d'inscriptions
 *   GET  /admin/stats/sync        → Volume sync + erreurs
 *   GET  /admin/stats/ai          → Consommation IA
 *   GET  /admin/stats/revenue     → Revenus estimés
 *   GET  /admin/stats/entities    → Entités créées (transactions, dettes, etc.)
 *   GET  /admin/logs              → Journal d'audit admin
 */
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { verifyToken } = require('../../../../../dry/utils/auth/jwt.util');

// ─── IMPORTS DES SCHÉMAS TRIVIDA ─────────────────────────────────────────────
const TransactionSchema     = require('../../transaction/model/transaction.schema');
const CustomerSchema        = require('../../customer/model/customer.schema');
const ActivitySchema        = require('../../activity/model/activity.schema');
const DebtSchema            = require('../../debt/model/debt.schema');
const SavingsGoalSchema     = require('../../savings/model/savingsGoal.schema');
const InvoiceSchema         = require('../../invoice/model/invoice.schema');
const ActivityRecetteSchema = require('../../activityRecette/model/activityRecette.schema');
const StockSchema           = require('../../stock/model/stock.schema');
const ProductCatalogSchema  = require('../../productCatalog/model/productCatalog.schema');
const BusinessProfileSchema = require('../../businessProfile/model/businessProfile.schema');
const AdminLogSchema        = require('../model/adminLog.schema.js');
const MetricsDailySchema    = require('../model/metricsDaily.schema.js');
const AdminNotificationSchema = require('../model/adminNotification.schema.js');
const AdminSettingsSchema   = require('../model/adminSettings.schema.js');
const { generateExcel, generateCSV, formatDateForExport, formatXAF } = require('../services/adminExport.service');
const { createAndBroadcastNotification } = require('../services/adminSocket.service');
const { sendBulkMessage, renderTemplate } = require('../services/adminMessaging.service');

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enregistrer une action admin dans le journal d'audit
 */
async function logAdminAction(req, action, details = {}) {
    try {
        const AdminLog = req.getModel('TrividaAdminLog', AdminLogSchema);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action,
            targetUserId: details.targetUserId || null,
            targetUserEmail: details.targetUserEmail || null,
            details: details.extra || {},
            ip: req.ip || req.connection?.remoteAddress,
        });
    } catch (error) {
        console.error('[AdminLog] Erreur enregistrement:', error.message);
    }
}

/**
 * Obtenir un modèle Trivida pour une entité spécifique
 */
function getModelForEntity(req, modelName, schema) {
    try {
        return req.getModel(modelName, schema);
    } catch (error) {
        console.error(`[Admin] Modèle ${modelName} non trouvé:`, error.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/login
 * Authentification admin — vérifie email + password + role superadmin
 * Retourne un JWT classique (même format que l'auth mobile)
 */
exports.adminLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        throw httpError('Email et mot de passe requis', 400);
    }
    
    const User = req.getModel('User');
    
    // Chercher l'utilisateur avec le password inclus (select: false par défaut)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
        .select('+password');
    
    if (!user) {
        throw httpError('Identifiants incorrects', 401);
    }
    
    // Vérifier le mot de passe
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        throw httpError('Identifiants incorrects', 401);
    }
    
    // Vérifier le rôle (admin ou superadmin)
    if (user.role !== 'superadmin' && user.role !== 'admin') {
        throw httpError('Accès réservé aux administrateurs', 403);
    }
    
    // Vérifier le statut
    if (user.status === 'deleted' || user.status === 'banned') {
        throw httpError('Compte désactivé', 403);
    }
    
    // Générer les tokens (réutilise les utilitaires JWT existants)
    const { signAccessToken } = require('../../../../../dry/utils/auth/jwt.util');
    const token = signAccessToken(user._id);
    
    // Logger la connexion admin
    await logAdminAction(req, 'admin_login', {
        extra: { email: user.email, loginAt: new Date() }
    });
    
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshTokens;
    delete userData.resetCode;
    delete userData.resetCodeExpires;
    
    sendResponse(res, { user: userData, token, role: user.role }, 'Connexion admin réussie');
});

// ═══════════════════════════════════════════════════════════════════════════════
// GESTION DES UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/users
 * Liste paginée des utilisateurs avec filtres
 * Query params: page, limit, search, plan, status, sort
 */
exports.getUsers = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    // Construction du filtre
    const filter = {};
    
    // Recherche par nom ou email
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filter.$or = [
            { name: searchRegex },
            { email: searchRegex },
        ];
    }
    
    // Filtre par plan
    if (req.query.plan && ['free', 'basic', 'premium'].includes(req.query.plan)) {
        filter.premiumPlan = req.query.plan;
    }
    
    // Filtre par statut
    if (req.query.status && ['active', 'inactive', 'deleted'].includes(req.query.status)) {
        filter.status = req.query.status;
    }
    
    // Tri
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    
    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean(),
        User.countDocuments(filter),
    ]);
    
    sendResponse(res, users, 'Utilisateurs récupérés', true, {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
    });
});

/**
 * GET /admin/users/:id
 * Détail complet d'un utilisateur + stats d'activité
 */
exports.getUserById = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const user = await User.findById(req.params.id).lean();
    
    if (!user) {
        throw httpError('Utilisateur introuvable', 404);
    }
    
    // Récupérer les stats d'activité de l'utilisateur
    const stats = {};
    
    const entities = [
        { name: 'transactions', schema: TransactionSchema, modelName: 'TrividaTransaction' },
        { name: 'customers', schema: CustomerSchema, modelName: 'TrividaCustomer' },
        { name: 'activities', schema: ActivitySchema, modelName: 'TrividaActivity' },
        { name: 'debts', schema: DebtSchema, modelName: 'TrividaDebt' },
        { name: 'savingsGoals', schema: SavingsGoalSchema, modelName: 'TrividaSavingsGoal' },
        { name: 'invoices', schema: InvoiceSchema, modelName: 'TrividaInvoice' },
    ];
    
    for (const entity of entities) {
        try {
            const Model = req.getModel(entity.modelName, entity.schema);
            stats[entity.name] = await Model.countDocuments({ userId: req.params.id });
        } catch (e) {
            stats[entity.name] = 0;
        }
    }
    
    sendResponse(res, { ...user, activityStats: stats }, 'Détail utilisateur récupéré');
});

/**
 * PATCH /admin/users/:id/status
 * Changer le statut d'un utilisateur (activer, suspendre, supprimer)
 * Body: { status: 'active' | 'inactive' | 'deleted' }
 */
exports.updateUserStatus = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'deleted'].includes(status)) {
        throw httpError('Statut invalide. Valeurs acceptées: active, inactive, deleted', 400);
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
        throw httpError('Utilisateur introuvable', 404);
    }
    
    const oldStatus = user.status;
    user.status = status;
    
    // Synchroniser le soft delete
    if (status === 'deleted') {
        user.deleted = true;
        user.deletedAt = new Date();
    } else if (user.deleted) {
        user.deleted = false;
        user.deletedAt = null;
    }
    
    await user.save();
    
    // Logger l'action
    await logAdminAction(req, 'user_status_change', {
        targetUserId: user._id,
        targetUserEmail: user.email,
        extra: { oldStatus, newStatus: status },
    });
    
    sendResponse(res, { user: user.toJSON() }, `Statut mis à jour: ${status}`);
});

/**
 * PATCH /admin/users/:id/plan
 * Changer le plan premium d'un utilisateur
 * Body: { plan: 'free' | 'basic' | 'premium', duration?: number (jours) }
 */
exports.updateUserPlan = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const { plan, duration } = req.body;
    
    if (!plan || !['free', 'basic', 'premium'].includes(plan)) {
        throw httpError('Plan invalide. Valeurs acceptées: free, basic, premium', 400);
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
        throw httpError('Utilisateur introuvable', 404);
    }
    
    const oldPlan = user.premiumPlan;
    
    user.premiumPlan = plan;
    
    if (plan === 'free') {
        user.isPremium = false;
        user.premiumUntil = null;
    } else {
        user.isPremium = true;
        // Durée par défaut : 30 jours si non spécifié
        const days = parseInt(duration) || 30;
        user.premiumUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    
    await user.save();
    
    // Logger l'action
    await logAdminAction(req, 'user_plan_change', {
        targetUserId: user._id,
        targetUserEmail: user.email,
        extra: { oldPlan, newPlan: plan, duration: duration || 30 },
    });
    
    sendResponse(res, { 
        user: user.toJSON(),
        plan: user.premiumPlan,
        premiumUntil: user.premiumUntil,
    }, `Plan mis à jour: ${plan}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/stats/overview
 * KPIs globaux : total users, actifs, nouveaux cette semaine, premium, etc.
 */
exports.getOverview = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [
        totalUsers,
        activeUsers,
        newUsersThisWeek,
        newUsersThisMonth,
        premiumUsers,
        basicUsers,
        freeUsers,
        usersActiveToday,
        deletedUsers,
        lockedUsers,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        User.countDocuments({ premiumPlan: 'premium', status: 'active' }),
        User.countDocuments({ premiumPlan: 'basic', status: 'active' }),
        User.countDocuments({ $or: [{ premiumPlan: 'free' }, { premiumPlan: null }], status: 'active' }),
        User.countDocuments({ lastLogin: { $gte: today } }),
        User.countDocuments({ status: 'deleted' }),
        User.countDocuments({ lockUntil: { $gt: now } }),
    ]);
    
    sendResponse(res, {
        totalUsers,
        activeUsers,
        newUsersThisWeek,
        newUsersThisMonth,
        premiumUsers,
        basicUsers,
        freeUsers,
        usersActiveToday,
        deletedUsers,
        lockedUsers,
    }, 'Statistiques globales récupérées');
});

/**
 * GET /admin/stats/growth
 * Courbe d'inscriptions par jour/semaine/mois
 * Query params: period (day|week|month), days (défaut 30)
 */
exports.getGrowth = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Agrégation par jour
    const growth = await User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 },
            }
        },
        { $sort: { _id: 1 } },
    ]);
    
    // Remplir les jours manquants avec 0
    const result = [];
    const currentDate = new Date(since);
    const today = new Date();
    
    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const found = growth.find(g => g._id === dateStr);
        result.push({
            date: dateStr,
            count: found ? found.count : 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    sendResponse(res, result, `Croissance sur les ${days} derniers jours`);
});

/**
 * GET /admin/stats/sync
 * Volume de sync, erreurs, entités synchronisées
 */
exports.getSyncStats = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    // Compter les utilisateurs ayant sync récemment
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [
        usersSyncToday,
        usersSyncWeek,
        usersNeverSynced,
        totalDeviceIds,
    ] = await Promise.all([
        User.countDocuments({ lastSyncAt: { $gte: oneDayAgo } }),
        User.countDocuments({ lastSyncAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ lastSyncAt: null }),
        User.aggregate([
            { $unwind: '$deviceIds' },
            { $count: 'total' },
        ]).then(r => r[0]?.total || 0),
    ]);
    
    sendResponse(res, {
        usersSyncToday,
        usersSyncWeek,
        usersNeverSynced,
        totalDeviceIds,
    }, 'Statistiques de synchronisation');
});

/**
 * GET /admin/stats/ai
 * Consommation IA : requêtes totales, utilisateurs actifs, quota atteint
 */
exports.getAIStats = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const [
        totalAIRequestsToday,
        usersWithAIRequests,
        usersQuotaReached,
    ] = await Promise.all([
        // Somme des aiRequestsToday de tous les users
        User.aggregate([
            { $group: { _id: null, total: { $sum: '$aiRequestsToday' } } }
        ]).then(r => r[0]?.total || 0),
        // Users qui ont fait au moins 1 requête IA aujourd'hui
        User.countDocuments({ aiRequestsToday: { $gt: 0 } }),
        // Users qui ont atteint le quota (5/jour par défaut)
        User.countDocuments({ aiRequestsToday: { $gte: 5 } }),
    ]);
    
    sendResponse(res, {
        totalAIRequestsToday,
        usersWithAIRequests,
        usersQuotaReached,
        quotaLimit: 5,
    }, 'Statistiques IA');
});

/**
 * GET /admin/stats/revenue
 * Revenus estimés par plan
 */
exports.getRevenueStats = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    // Tarifs mensuels depuis les paramètres dynamiques
    let PLAN_PRICES = { basic: 1500, premium: 3500 };
    try {
        const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
        const settings = await AdminSettings.findOne();
        if (settings?.planPrices) {
            PLAN_PRICES = { basic: settings.planPrices.basic || 1500, premium: settings.planPrices.premium || 3500 };
        }
    } catch (e) { /* fallback sur les prix par défaut */ }
    
    const [basicCount, premiumCount, expiringSoon] = await Promise.all([
        User.countDocuments({ premiumPlan: 'basic', status: 'active' }),
        User.countDocuments({ premiumPlan: 'premium', status: 'active' }),
        // Abonnements expirant dans les 7 prochains jours
        User.countDocuments({
            premiumPlan: { $in: ['basic', 'premium'] },
            premiumUntil: { 
                $gte: new Date(), 
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
            }
        }),
    ]);
    
    const estimatedMonthlyRevenue = 
        (basicCount * PLAN_PRICES.basic) + 
        (premiumCount * PLAN_PRICES.premium);
    
    sendResponse(res, {
        basicSubscribers: basicCount,
        premiumSubscribers: premiumCount,
        estimatedMonthlyRevenue,
        expiringIn7Days: expiringSoon,
        planPrices: PLAN_PRICES,
    }, 'Statistiques de revenus');
});

/**
 * GET /admin/stats/entities
 * Nombre total d'entités créées (transactions, dettes, etc.)
 */
exports.getEntityStats = asyncHandler(async (req, res) => {
    const entities = [
        { name: 'transactions', schema: TransactionSchema, modelName: 'TrividaTransaction' },
        { name: 'customers', schema: CustomerSchema, modelName: 'TrividaCustomer' },
        { name: 'activities', schema: ActivitySchema, modelName: 'TrividaActivity' },
        { name: 'debts', schema: DebtSchema, modelName: 'TrividaDebt' },
        { name: 'savingsGoals', schema: SavingsGoalSchema, modelName: 'TrividaSavingsGoal' },
        { name: 'invoices', schema: InvoiceSchema, modelName: 'TrividaInvoice' },
        { name: 'stocks', schema: StockSchema, modelName: 'TrividaStock' },
        { name: 'products', schema: ProductCatalogSchema, modelName: 'TrividaProductCatalog' },
        { name: 'businessProfiles', schema: BusinessProfileSchema, modelName: 'TrividaBusinessProfile' },
    ];
    
    const stats = {};
    
    for (const entity of entities) {
        try {
            const Model = req.getModel(entity.modelName, entity.schema);
            stats[entity.name] = await Model.countDocuments({ deleted: { $ne: true } });
        } catch (e) {
            stats[entity.name] = 0;
        }
    }
    
    sendResponse(res, stats, 'Statistiques des entités');
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL D'AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/logs
 * Journal d'audit admin (dernières actions)
 * Query params: page, limit, action, adminId
 */
exports.getAdminLogs = asyncHandler(async (req, res) => {
    const AdminLog = req.getModel('TrividaAdminLog', AdminLogSchema);
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.adminId) filter.adminId = req.query.adminId;
    
    const [logs, total] = await Promise.all([
        AdminLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AdminLog.countDocuments(filter),
    ]);
    
    sendResponse(res, logs, 'Journal d\'audit récupéré', true, {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// APP UPDATE MANIFEST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/app/update
 * Lire le manifest de mise à jour actuel
 */
exports.getAppUpdate = asyncHandler(async (req, res) => {
    // Le manifest est stocké en variable globale dans routes.js
    // On le lit depuis le req (injecté par le middleware)
    const manifest = req.appUpdateManifest || {
        latest: '1.2.0',
        minimum: '1.1.1',
        force: false,
        changelog: [],
    };
    
    sendResponse(res, manifest, 'Manifest de mise à jour');
});

/**
 * PATCH /admin/app/update
 * Modifier le manifest de mise à jour
 * Body: { latest?, minimum?, force?, changelog? }
 */
exports.updateAppManifest = asyncHandler(async (req, res) => {
    const { latest, minimum, force, changelog } = req.body;
    
    const manifest = req.appUpdateManifest || {
        latest: '1.2.0',
        minimum: '1.1.1',
        force: false,
        changelog: [],
    };
    
    if (latest !== undefined) manifest.latest = latest;
    if (minimum !== undefined) manifest.minimum = minimum;
    if (force !== undefined) manifest.force = force;
    if (changelog !== undefined) manifest.changelog = changelog;
    
    // Sauvegarder via req (le routeur doit exposer appUpdateManifest)
    req.appUpdateManifest = manifest;
    
    // Logger l'action
    await logAdminAction(req, 'app_update_manifest', {
        extra: { manifest },
    });
    
    sendResponse(res, manifest, 'Manifest de mise à jour mis à jour');
});

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE IA & MÉTRIQUES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/stats/ai/history
 * Historique de consommation IA par jour
 * Query params: days (défaut 30)
 */
exports.getAIHistory = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Agréger les requêtes IA par jour depuis les snapshots MetricsDaily
    // Si pas de snapshots, on calcule en temps réel
    let MetricsDaily;
    try {
        MetricsDaily = req.getModel('TrividaMetricsDaily', MetricsDailySchema);
    } catch (e) {
        MetricsDaily = null;
    }
    
    let history = [];
    
    if (MetricsDaily) {
        // Utiliser les snapshots pré-calculés
        const snapshots = await MetricsDaily.find({ date: { $gte: since } })
            .sort({ date: 1 })
            .select('date totalAIRequests usersWithAIRequests usersQuotaReached')
            .lean();
        
        history = snapshots.map(s => ({
            date: s.date.toISOString().split('T')[0],
            totalRequests: s.totalAIRequests || 0,
            activeUsers: s.usersWithAIRequests || 0,
            quotaReached: s.usersQuotaReached || 0,
        }));
    }
    
    // Si pas assez de snapshots, compléter avec les données live
    if (history.length < days) {
        const today = new Date();
        const todayData = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: '$aiRequestsToday' },
                    activeUsers: { $sum: { $cond: [{ $gt: ['$aiRequestsToday', 0] }, 1, 0] } },
                    quotaReached: { $sum: { $cond: [{ $gte: ['$aiRequestsToday', 5] }, 1, 0] } },
                }
            }
        ]);
        
        const todayStr = today.toISOString().split('T')[0];
        const todayStats = todayData[0] || { totalRequests: 0, activeUsers: 0, quotaReached: 0 };
        
        // Ajouter aujourd'hui si pas déjà présent
        if (!history.find(h => h.date === todayStr)) {
            history.push({
                date: todayStr,
                totalRequests: todayStats.totalRequests,
                activeUsers: todayStats.activeUsers,
                quotaReached: todayStats.quotaReached,
            });
        }
    }
    
    // Trier par date
    history.sort((a, b) => a.date.localeCompare(b.date));
    
    sendResponse(res, history, `Historique IA sur les ${days} derniers jours`);
});

/**
 * GET /admin/stats/metrics/history
 * Historique des métriques quotidiennes (snapshots)
 * Query params: days (défaut 30)
 */
exports.getMetricsHistory = asyncHandler(async (req, res) => {
    const MetricsDaily = req.getModel('TrividaMetricsDaily', MetricsDailySchema);
    
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const snapshots = await MetricsDaily.find({ date: { $gte: since } })
        .sort({ date: 1 })
        .lean();
    
    sendResponse(res, snapshots, `Historique métriques sur ${days} jours`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS IN-APP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/notifications
 * Récupérer les notifications admin
 * Query params: page, limit, unreadOnly
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const AdminNotification = req.getModel('TrividaAdminNotification', AdminNotificationSchema);
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.unreadOnly === 'true') {
        filter.read = false;
    }
    
    const [notifications, total, unreadCount] = await Promise.all([
        AdminNotification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AdminNotification.countDocuments(filter),
        AdminNotification.countDocuments({ read: false }),
    ]);
    
    sendResponse(res, { notifications, unreadCount }, 'Notifications récupérées', true, {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
    });
});

/**
 * PATCH /admin/notifications/:id/read
 * Marquer une notification comme lue
 */
exports.markNotificationRead = asyncHandler(async (req, res) => {
    const AdminNotification = req.getModel('TrividaAdminNotification', AdminNotificationSchema);
    
    const notification = await AdminNotification.findByIdAndUpdate(
        req.params.id,
        { read: true, readAt: new Date() },
        { new: true }
    );
    
    if (!notification) {
        throw httpError('Notification introuvable', 404);
    }
    
    // Mettre à jour le compteur via Socket.IO
    const { getIO } = require('../services/adminSocket.service');
    const io = getIO();
    if (io) {
        const unreadCount = await AdminNotification.countDocuments({ read: false });
        io.to('admins').emit('notifications:count', unreadCount);
    }
    
    sendResponse(res, notification, 'Notification marquée comme lue');
});

/**
 * PATCH /admin/notifications/read-all
 * Marquer toutes les notifications comme lues
 */
exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
    const AdminNotification = req.getModel('TrividaAdminNotification', AdminNotificationSchema);
    
    await AdminNotification.updateMany(
        { read: false },
        { $set: { read: true, readAt: new Date() } }
    );
    
    // Mettre à jour le compteur via Socket.IO
    const { getIO } = require('../services/adminSocket.service');
    const io = getIO();
    if (io) {
        io.to('admins').emit('notifications:count', 0);
    }
    
    sendResponse(res, null, 'Toutes les notifications marquées comme lues');
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT CSV / EXCEL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/export/users
 * Exporter la liste des utilisateurs en CSV ou Excel
 * Query params: format (csv|excel), search, plan, status
 */
exports.exportUsers = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const format = req.query.format === 'excel' ? 'excel' : 'csv';
    
    // Construire le même filtre que getUsers
    const filter = {};
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }
    if (req.query.plan && ['free', 'basic', 'premium'].includes(req.query.plan)) {
        filter.premiumPlan = req.query.plan;
    }
    if (req.query.status && ['active', 'inactive', 'deleted'].includes(req.query.status)) {
        filter.status = req.query.status;
    }
    
    // Limite de 10 000 pour éviter les exports trop lourds
    const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .limit(10000)
        .lean();
    
    const headers = [
        'Nom', 'Email', 'Téléphone', 'Plan', 'Statut', 'Rôle',
        'Inscrit le', 'Dernière synchro', 'Dernière connexion',
        'Requêtes IA', 'Appareils', 'Premium expire le',
    ];
    
    const rows = users.map(u => [
        u.name,
        u.email,
        u.telephone || '',
        u.premiumPlan || 'free',
        u.status,
        u.role || 'user',
        formatDateForExport(u.createdAt),
        formatDateForExport(u.lastSyncAt),
        formatDateForExport(u.lastLogin),
        u.aiRequestsToday || 0,
        u.deviceIds?.length || 0,
        u.premiumUntil ? formatDateForExport(u.premiumUntil) : '',
    ]);
    
    if (format === 'excel') {
        const buffer = await generateExcel({
            sheetName: 'Utilisateurs Trivida',
            headers,
            rows,
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=trivida_users.xlsx');
        return res.send(buffer);
    }
    
    // CSV
    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=trivida_users.csv');
    // BOM pour Excel FR
    res.send('\uFEFF' + csv);
});

/**
 * GET /admin/export/stats
 * Exporter les statistiques globales en CSV ou Excel
 * Query params: format (csv|excel)
 */
exports.exportStats = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const format = req.query.format === 'excel' ? 'excel' : 'csv';
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // KPIs
    const [
        totalUsers, activeUsers, newWeek, newMonth,
        premiumUsers, basicUsers, freeUsers,
        activeToday, deletedUsers, lockedUsers,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        User.countDocuments({ premiumPlan: 'premium', status: 'active' }),
        User.countDocuments({ premiumPlan: 'basic', status: 'active' }),
        User.countDocuments({ $or: [{ premiumPlan: 'free' }, { premiumPlan: null }], status: 'active' }),
        User.countDocuments({ lastLogin: { $gte: today } }),
        User.countDocuments({ status: 'deleted' }),
        User.countDocuments({ lockUntil: { $gt: now } }),
    ]);
    
    // Prix dynamiques depuis les settings
    let PLAN_PRICES = { basic: 1500, premium: 3500 };
    try {
        const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
        const settings = await AdminSettings.findOne();
        if (settings?.planPrices) PLAN_PRICES = { basic: settings.planPrices.basic || 1500, premium: settings.planPrices.premium || 3500 };
    } catch (e) { /* fallback */ }
    const revenue = (basicUsers * PLAN_PRICES.basic) + (premiumUsers * PLAN_PRICES.premium);
    
    // Format tableau pour export
    const headers = ['Métrique', 'Valeur', 'Description'];
    const rows = [
        ['Total utilisateurs', totalUsers, 'Tous les comptes (actifs + supprimés)'],
        ['Utilisateurs actifs', activeUsers, 'Comptes non supprimés'],
        ['Actifs aujourd\'hui', activeToday, 'Connectés depuis minuit'],
        ['Nouveaux (7j)', newWeek, 'Inscriptions cette semaine'],
        ['Nouveaux (30j)', newMonth, 'Inscriptions ce mois'],
        ['Premium', premiumUsers, 'Abonnés Premium actifs'],
        ['Basic', basicUsers, 'Abonnés Basic actifs'],
        ['Free', freeUsers, 'Utilisateurs gratuits actifs'],
        ['Comptes supprimés', deletedUsers, 'Soft-deleted'],
        ['Utilisateurs verrouillés', lockedUsers, 'Trop de tentatives'],
        ['Revenu mensuel estimé', `${formatXAF(revenue)} XAF`, 'Basic × 1500 + Premium × 3500'],
        ['Taux de conversion', `${activeUsers > 0 ? Math.round(((premiumUsers + basicUsers) / activeUsers) * 100) : 0}%`, 'Payants / actifs'],
    ];
    
    if (format === 'excel') {
        const buffer = await generateExcel({
            sheetName: 'Statistiques Trivida',
            headers,
            rows,
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=trivida_stats.xlsx');
        return res.send(buffer);
    }
    
    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=trivida_stats.csv');
    res.send('\uFEFF' + csv);
});

/**
 * GET /admin/export/metrics
 * Exporter l'historique des métriques quotidiennes
 * Query params: format (csv|excel), days (défaut 30)
 */
exports.exportMetrics = asyncHandler(async (req, res) => {
    const MetricsDaily = req.getModel('TrividaMetricsDaily', MetricsDailySchema);
    const format = req.query.format === 'excel' ? 'excel' : 'csv';
    
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const snapshots = await MetricsDaily.find({ date: { $gte: since } })
        .sort({ date: 1 })
        .lean();
    
    const headers = [
        'Date', 'Total Users', 'Actifs', 'Nouveaux', 'Premium', 'Basic', 'Free',
        'Sync today', 'IA Requêtes', 'IA Actifs', 'IA Quota',
        'Transactions', 'Clients', 'Dettes', 'Épargne', 'Factures',
        'Revenu estimé (XAF)',
    ];
    
    const rows = snapshots.map(s => [
        s.date ? new Date(s.date).toLocaleDateString('fr-FR') : '',
        s.totalUsers || 0,
        s.activeUsers || 0,
        s.newUsers || 0,
        s.premiumUsers || 0,
        s.basicUsers || 0,
        s.freeUsers || 0,
        s.usersSyncedToday || 0,
        s.totalAIRequests || 0,
        s.usersWithAIRequests || 0,
        s.usersQuotaReached || 0,
        s.totalTransactions || 0,
        s.totalCustomers || 0,
        s.totalDebts || 0,
        s.totalSavingsGoals || 0,
        s.totalInvoices || 0,
        s.estimatedMonthlyRevenue || 0,
    ]);
    
    if (format === 'excel') {
        const buffer = await generateExcel({
            sheetName: 'Métriques Trivida',
            headers,
            rows,
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=trivida_metrics_${days}j.xlsx`);
        return res.send(buffer);
    }
    
    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=trivida_metrics_${days}j.csv`);
    res.send('\uFEFF' + csv);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMÈTRES DYNAMIQUES (prix, quotas, templates)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/settings
 * Récupérer les paramètres admin (prix, quotas, templates)
 */
exports.getSettings = asyncHandler(async (req, res) => {
    const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
    
    let settings = await AdminSettings.findOne();
    if (!settings) {
        settings = await AdminSettings.create({});
    }
    
    sendResponse(res, settings, 'Paramètres récupérés');
});

/**
 * PATCH /admin/settings
 * Modifier les paramètres admin
 * Body: { planPrices?, aiQuotaPerDay?, alerts?, whatsapp?, messageTemplates? }
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
    
    let settings = await AdminSettings.findOne();
    if (!settings) {
        settings = new AdminSettings({});
    }
    
    const { planPrices, aiQuotaPerDay, alerts, whatsapp, messageTemplates } = req.body;
    
    if (planPrices) {
        if (planPrices.basic !== undefined) settings.planPrices.basic = planPrices.basic;
        if (planPrices.premium !== undefined) settings.planPrices.premium = planPrices.premium;
        if (planPrices.currency !== undefined) settings.planPrices.currency = planPrices.currency;
    }
    if (aiQuotaPerDay !== undefined) settings.aiQuotaPerDay = aiQuotaPerDay;
    if (alerts) {
        if (alerts.expiringDaysBefore !== undefined) settings.alerts.expiringDaysBefore = alerts.expiringDaysBefore;
        if (alerts.lockThreshold !== undefined) settings.alerts.lockThreshold = alerts.lockThreshold;
    }
    if (whatsapp) {
        if (whatsapp.enabled !== undefined) settings.whatsapp.enabled = whatsapp.enabled;
        if (whatsapp.apiKey !== undefined) settings.whatsapp.apiKey = whatsapp.apiKey;
        if (whatsapp.phone !== undefined) settings.whatsapp.phone = whatsapp.phone;
    }
    if (messageTemplates) {
        Object.assign(settings.messageTemplates, messageTemplates);
    }
    
    await settings.save();
    
    await logAdminAction(req, 'settings_updated', {
        extra: { updatedFields: Object.keys(req.body) },
    });
    
    sendResponse(res, settings, 'Paramètres mis à jour');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGERIE (EMAIL + WHATSAPP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/messaging/send
 * Envoyer un message (email et/ou WhatsApp) à des utilisateurs
 * Body: {
 *   target: 'all' | 'free' | 'basic' | 'premium' | 'expiring' | 'custom',
 *   userIds?: string[],       // si target='custom'
 *   channel: 'email' | 'whatsapp' | 'both',
 *   subject: string,          // pour email
 *   message: string,
 *   templateKey?: string,     // optionnel: utiliser un template prédéfini
 * }
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
    
    const { target, userIds, channel, subject, message, templateKey } = req.body;
    
    if (!target || !channel || !message) {
        throw httpError('Champs requis : target, channel, message', 400);
    }
    
    // Charger les paramètres pour WhatsApp config et templates
    let settings = await AdminSettings.findOne();
    if (!settings) settings = await AdminSettings.create({});
    
    // Construire le filtre utilisateur
    let filter = {};
    switch (target) {
        case 'all':
            filter = { status: 'active' };
            break;
        case 'free':
            filter = { $or: [{ premiumPlan: 'free' }, { premiumPlan: null }], status: 'active' };
            break;
        case 'basic':
            filter = { premiumPlan: 'basic', status: 'active' };
            break;
        case 'premium':
            filter = { premiumPlan: 'premium', status: 'active' };
            break;
        case 'expiring':
            filter = {
                premiumPlan: { $in: ['basic', 'premium'] },
                premiumUntil: { $gte: new Date(), $lte: new Date(Date.now() + (settings.alerts?.expiringDaysBefore || 7) * 24 * 60 * 60 * 1000) },
            };
            break;
        case 'inactive':
            filter = {
                status: 'active',
                lastLogin: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Pas de connexion depuis 30+ jours
            };
            break;
        case 'no_activity':
            filter = {
                status: 'active',
                $or: [
                    { lastLogin: { $exists: false } },
                    { lastLogin: null },
                    { lastLogin: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                ],
            };
            break;
        case 'custom':
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                throw httpError('userIds requis pour target=custom', 400);
            }
            filter = { _id: { $in: userIds } };
            break;
        default:
            throw httpError('target invalide. Valeurs: all, free, basic, premium, expiring, inactive, no_activity, custom', 400);
    }
    
    const users = await User.find(filter).select('name email telephone premiumPlan premiumUntil').lean();
    
    if (users.length === 0) {
        throw httpError('Aucun utilisateur trouvé pour ce filtre', 404);
    }
    
    // Utiliser un template si spécifié
    let finalSubject = subject || 'Message Trivida';
    const finalMessage = message;
    
    if (templateKey && settings.messageTemplates?.[templateKey]) {
        const tpl = settings.messageTemplates[templateKey];
        finalSubject = tpl.subject;
        // Le template sera rendu pour chaque user individuellement
    }
    
    // Envoyer en lot (variables rendues individuellement)
    const results = [];
    for (const user of users) {
        const vars = {
            name: user.name || '',
            email: user.email || '',
            plan: user.premiumPlan || 'free',
            expiry: user.premiumUntil ? new Date(user.premiumUntil).toLocaleDateString('fr-FR') : '',
        };
        
        // Rendre les variables {name}, {plan}, etc. dans le message et le sujet
        const tplBody = templateKey ? settings.messageTemplates[templateKey]?.body : message;
        const tplSubject = templateKey ? settings.messageTemplates[templateKey]?.subject : subject;
        const userMessage = renderTemplate(tplBody || message, vars);
        const userSubject = renderTemplate(tplSubject || subject || 'Message Trivida', vars);
        
        // Convertir en HTML pour l'email
        const htmlMessage = userMessage.replace(/\n/g, '<br>');
        
        // Envoyer email avec template pro Trivida
        let emailResult = null;
        if ((channel === 'email' || channel === 'both') && user.email) {
            const { sendEmail } = require('../services/adminMessaging.service');
            const emailService = require('../../../../../dry/services/auth/email.service');
            const rawTemplate = emailService.loadTemplate('trivida-admin-message.html');
            let html;
            if (rawTemplate) {
                html = emailService.renderTemplate(rawTemplate, {
                    NAME: user.name || 'Utilisateur',
                    MESSAGE: htmlMessage,
                    SUBJECT: userSubject,
                    APP_URL: emailService.resolveAppUrl('trivida'),
                    YEAR: new Date().getFullYear(),
                });
            } else {
                // Fallback si template manquant
                html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#006B4D,#005A41);color:white;padding:20px;border-radius:12px 12px 0 0;"><h1 style="margin:0;font-size:20px;">Trivida</h1></div><div style="background:#111413;padding:24px;border-radius:0 0 12px 12px;color:#e2e8f0;"><div style="line-height:1.8;font-size:15px;">${htmlMessage}</div></div></div>`;
            }
            emailResult = await sendEmail({
                to: user.email,
                subject: userSubject,
                html,
            });
        }
        
        // Envoyer WhatsApp
        let whatsappResult = null;
        if ((channel === 'whatsapp' || channel === 'both') && settings.whatsapp?.enabled && user.telephone) {
            const { sendWhatsApp } = require('../services/adminMessaging.service');
            whatsappResult = await sendWhatsApp({
                phone: user.telephone,
                message: userMessage,
                apiKey: settings.whatsapp.apiKey,
            });
        }
        
        // Envoyer SMS
        let smsResult = null;
        if ((channel === 'sms' || channel === 'email_sms') && settings.sms?.enabled && user.telephone) {
            const { sendSMS } = require('../services/adminMessaging.service');
            smsResult = await sendSMS({
                to: user.telephone,
                message: userMessage,
                smsConfig: {
                    provider: settings.sms.provider,
                    apiKey: settings.sms.apiKey,
                    senderNumber: settings.sms.senderNumber,
                    username: settings.sms.username,
                    accountSid: settings.sms.accountSid,
                },
            });
        }
        
        const result = {
            total: 1,
            email: { sent: emailResult?.success ? 1 : 0, failed: emailResult?.success ? 0 : 1 },
            whatsapp: { sent: whatsappResult?.success ? 1 : 0, failed: whatsappResult?.success ? 0 : 1 },
            sms: { sent: smsResult?.success ? 1 : 0, failed: smsResult?.success ? 0 : 1 },
        };
        
        results.push({
            user: { name: user.name, email: user.email },
            ...result,
        });
    }
    
    // Résumé
    const summary = {
        total: users.length,
        channel,
        emailSent: results.reduce((s, r) => s + (r.email?.sent || 0), 0),
        emailFailed: results.reduce((s, r) => s + (r.email?.failed || 0), 0),
        whatsappSent: results.reduce((s, r) => s + (r.whatsapp?.sent || 0), 0),
        whatsappFailed: results.reduce((s, r) => s + (r.whatsapp?.failed || 0), 0),
        smsSent: results.reduce((s, r) => s + (r.sms?.sent || 0), 0),
        smsFailed: results.reduce((s, r) => s + (r.sms?.failed || 0), 0),
    };
    
    await logAdminAction(req, 'message_sent', {
        extra: { target, channel, recipientCount: users.length, summary },
    });
    
    sendResponse(res, summary, `${users.length} message(s) envoyé(s) via ${channel}`);
});

/**
 * GET /admin/messaging/templates
 * Récupérer les templates de messages disponibles
 */
exports.getMessageTemplates = asyncHandler(async (req, res) => {
    const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
    let settings = await AdminSettings.findOne();
    if (!settings) settings = await AdminSettings.create({});
    
    sendResponse(res, settings.messageTemplates, 'Templates récupérés');
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PERFORMANCE & AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/performance/dashboard
 * Dashboard complet de performance Trivida
 * Combine : users, sync, IA, entités, revenus, santé
 */
exports.getPerformanceDashboard = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // ── Requêtes parallèles ────────────────────────────────────────────
    const [
        // Utilisateurs
        totalUsers, activeUsers, newWeek, newMonth, activeToday,
        premiumUsers, basicUsers, freeUsers, deletedUsers, lockedUsers,
        // Sync
        usersSyncToday, usersSyncWeek, usersNeverSynced, totalDeviceIds,
        // IA
        aiRequestsToday, usersWithAI, usersQuotaReached,
        // Entités
        totalTransactions, totalCustomers, totalActivities,
        totalDebts, totalSavingsGoals, totalInvoices,
        totalStocks, totalProducts, totalBusinessProfiles,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        User.countDocuments({ lastLogin: { $gte: today } }),
        User.countDocuments({ premiumPlan: 'premium', status: 'active' }),
        User.countDocuments({ premiumPlan: 'basic', status: 'active' }),
        User.countDocuments({ $or: [{ premiumPlan: 'free' }, { premiumPlan: null }], status: 'active' }),
        User.countDocuments({ status: 'deleted' }),
        User.countDocuments({ lockUntil: { $gt: now } }),
        User.countDocuments({ lastSyncAt: { $gte: oneDayAgo } }),
        User.countDocuments({ lastSyncAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ lastSyncAt: null }),
        User.aggregate([{ $unwind: '$deviceIds' }, { $count: 'total' }]).then(r => r[0]?.total || 0),
        User.aggregate([{ $group: { _id: null, t: { $sum: '$aiRequestsToday' } } }]).then(r => r[0]?.t || 0),
        User.countDocuments({ aiRequestsToday: { $gt: 0 } }),
        User.countDocuments({ aiRequestsToday: { $gte: 5 } }),
        countEntity(req, 'TrividaTransaction', TransactionSchema),
        countEntity(req, 'TrividaCustomer', CustomerSchema),
        countEntity(req, 'TrividaActivity', ActivitySchema),
        countEntity(req, 'TrividaDebt', DebtSchema),
        countEntity(req, 'TrividaSavingsGoal', SavingsGoalSchema),
        countEntity(req, 'TrividaInvoice', InvoiceSchema),
        countEntity(req, 'TrividaStock', StockSchema),
        countEntity(req, 'TrividaProductCatalog', ProductCatalogSchema),
        countEntity(req, 'TrividaBusinessProfile', BusinessProfileSchema),
    ]);
    
    // Revenus
    let settings = null;
    try {
        const AdminSettings = req.getModel('TrividaAdminSettings', AdminSettingsSchema);
        settings = await AdminSettings.findOne();
    } catch (e) { /* pas encore de settings */ }
    
    const prices = settings?.planPrices || { basic: 1500, premium: 3500 };
    const estimatedRevenue = (basicUsers * prices.basic) + (premiumUsers * prices.premium);
    const expiringIn7Days = await User.countDocuments({
        premiumPlan: { $in: ['basic', 'premium'] },
        premiumUntil: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    });
    
    // Taux de conversion
    const conversionRate = activeUsers > 0 ? Math.round(((premiumUsers + basicUsers) / activeUsers) * 100) : 0;
    const syncRate = activeUsers > 0 ? Math.round((usersSyncWeek / activeUsers) * 100) : 0;
    const dauRatio = activeUsers > 0 ? Math.round((activeToday / activeUsers) * 100) : 0;
    
    // Score de santé global (0-100)
    const healthScore = Math.min(100, Math.round(
        (syncRate * 0.3) +
        (conversionRate * 0.2) +
        (dauRatio * 0.2) +
        (Math.max(0, 100 - (lockedUsers * 5)) * 0.15) +
        (Math.max(0, 100 - (deletedUsers > 0 ? (deletedUsers / totalUsers * 100) : 0)) * 0.15)
    ));
    
    sendResponse(res, {
        // Synthèse
        healthScore,
        // Utilisateurs
        users: { total: totalUsers, active: activeUsers, newWeek, newMonth, activeToday, premium: premiumUsers, basic: basicUsers, free: freeUsers, deleted: deletedUsers, locked: lockedUsers },
        // Sync
        sync: { today: usersSyncToday, week: usersSyncWeek, neverSynced: usersNeverSynced, devices: totalDeviceIds, syncRate },
        // IA
        ai: { requestsToday: aiRequestsToday, activeUsers: usersWithAI, quotaReached: usersQuotaReached, quotaLimit: settings?.aiQuotaPerDay || 5 },
        // Entités
        entities: { transactions: totalTransactions, customers: totalCustomers, activities: totalActivities, debts: totalDebts, savingsGoals: totalSavingsGoals, invoices: totalInvoices, stocks: totalStocks, products: totalProducts, businessProfiles: totalBusinessProfiles },
        // Revenus
        revenue: { estimatedMonthly: estimatedRevenue, expiringIn7Days, planPrices: prices },
        // Ratios
        ratios: { conversionRate, syncRate, dauRatio },
    }, 'Dashboard de performance');
});

/**
 * Helper : compter une entité en toute sécurité
 */
async function countEntity(req, modelName, schema) {
    try {
        const Model = req.getModel(modelName, schema);
        return await Model.countDocuments({ deleted: { $ne: true } });
    } catch (e) {
        return 0;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED ADMINS — endpoint temporaire pour créer admin + superadmin
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/seed-admins
 * Crée admin + superadmin si absents.
 * Protégé par un secret dans le body : { secret: 'TRIVIDA_SEED_2026' }
 */
exports.seedAdmins = asyncHandler(async (req, res) => {
    const { secret } = req.body;
    if (secret !== 'TRIVIDA_SEED_2026') {
        throw httpError('Secret invalide', 403);
    }

    const User = req.getModel('User');
    const results = [];

    // On crée les deux avec role 'admin' d'abord (compatible tout schema)
    const accounts = [
        {
            name: 'Super Admin Trivida',
            email: 'superadmin@trivida.app',
            password: 'Trivida@2026',
            telephone: '+242060000000',
            desiredRole: 'superadmin',
        },
        {
            name: 'Admin Trivida',
            email: 'admin@trivida.app',
            password: 'Trivida@2026',
            telephone: '+242060000001',
            desiredRole: 'admin',
        },
    ];

    // Vérifier si le schema supporte 'superadmin'
    const roleField = User.schema.path('role');
    const enumValues = roleField && roleField.enumValues ? roleField.enumValues : ['user', 'admin'];
    const hasSuperadmin = enumValues.includes('superadmin');

    for (const acct of accounts) {
        const existing = await User.findOne({ email: acct.email }).select('+password');
        if (existing) {
            // Mettre à jour le role si possible
            if (existing.role !== acct.desiredRole) {
                if (hasSuperadmin || acct.desiredRole === 'admin') {
                    // Mise à jour via save (validé par le schema)
                    existing.role = acct.desiredRole;
                    await existing.save();
                    results.push({ email: acct.email, action: 'role_updated', role: acct.desiredRole });
                } else {
                    // Schema ne supporte pas 'superadmin', mettre en admin
                    results.push({ email: acct.email, action: 'role_kept_admin', note: 'Schema ne supporte pas superadmin encore' });
                }
            } else {
                results.push({ email: acct.email, action: 'already_exists', role: acct.role });
            }
        } else {
            // Créer avec 'admin' d'abord (safe pour tout schema)
            const createRole = acct.desiredRole === 'admin' ? 'admin' : 'admin';
            const user = await User.create({
                name: acct.name,
                email: acct.email,
                password: acct.password,
                telephone: acct.telephone,
                role: createRole,
                status: 'active',
            });
            
            // Si on veut superadmin et que le schema le supporte, mettre à jour
            if (acct.desiredRole === 'superadmin' && hasSuperadmin) {
                user.role = 'superadmin';
                await user.save();
            }
            
            results.push({
                email: acct.email,
                action: 'created',
                role: acct.desiredRole === 'superadmin' && !hasSuperadmin ? 'admin' : acct.desiredRole,
                id: user._id,
                note: acct.desiredRole === 'superadmin' && !hasSuperadmin ? 'Schema ancien: créé en admin, met à jour après déploiement du nouveau schema' : undefined
            });
        }
    }

    // Info sur le schema
    sendResponse(res, {
        accounts: results,
        schemaInfo: {
            roleEnum: enumValues,
            hasSuperadmin
        }
    }, 'Seed admins terminé');
});
