/**
 * Cron Job — Snapshots de métriques quotidiennes Trivida
 * 
 * Exécuté chaque jour à minuit (0 0 * * *).
 * Calcule et stocke les métriques agrégées de la veille dans
 * la collection trivida_metrics_daily.
 * 
 * Utilisé par le panel admin pour afficher l'historique des KPIs
 * sans recalculer à chaque requête (performance).
 * 
 * Dépendances : node-cron (déjà installé dans dryApi)
 */
const cron = require('node-cron');
const getModel = require('../../../../../dry/core/factories/modelFactory');
const { getTenantDB } = require('../../../../../dry/config/connection/dbConnection');

// ─── Import des schémas ──────────────────────────────────────────────────────
const MetricsDailySchema    = require('../model/metricsDaily.schema.js');
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

const APP_NAME = 'Trivida';

/**
 * Calculer les métriques pour une date donnée
 * @param {Date} date - La date pour laquelle calculer les métriques
 * @returns {Object} Les métriques calculées
 */
async function calculateMetricsForDate(date) {
    // Début et fin de la journée
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    // Injecter le contexte multi-tenant
    let User;
    try {
        User = getModel(APP_NAME, 'User');
    } catch (e) {
        console.error(`[MetricsCron] Impossible d'obtenir le modèle User:`, e.message);
        return null;
    }
    
    // ── Utilisateurs ────────────────────────────────────────────────────────
    const [
        totalUsers,
        activeUsers,
        newUsers,
        premiumUsers,
        basicUsers,
        freeUsers,
        deletedUsers,
        lockedUsers,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } }),
        User.countDocuments({ premiumPlan: 'premium', status: 'active' }),
        User.countDocuments({ premiumPlan: 'basic', status: 'active' }),
        User.countDocuments({ $or: [{ premiumPlan: 'free' }, { premiumPlan: null }], status: 'active' }),
        User.countDocuments({ status: 'deleted' }),
        User.countDocuments({ lockUntil: { $gt: now } }),
    ]);
    
    // ── Synchronisation ─────────────────────────────────────────────────────
    const [usersSyncedToday, totalDeviceIds] = await Promise.all([
        User.countDocuments({ lastSyncAt: { $gte: startOfDay, $lt: endOfDay } }),
        User.aggregate([
            { $unwind: '$deviceIds' },
            { $count: 'total' },
        ]).then(r => r[0]?.total || 0),
    ]);
    
    // ── IA ──────────────────────────────────────────────────────────────────
    const [totalAIRequests, usersWithAIRequests, usersQuotaReached] = await Promise.all([
        User.aggregate([
            { $group: { _id: null, total: { $sum: '$aiRequestsToday' } } }
        ]).then(r => r[0]?.total || 0),
        User.countDocuments({ aiRequestsToday: { $gt: 0 } }),
        User.countDocuments({ aiRequestsToday: { $gte: 5 } }),
    ]);
    
    // ── Entités métier ──────────────────────────────────────────────────────
    const entityConfigs = [
        { key: 'totalTransactions', schema: TransactionSchema, modelName: 'TrividaTransaction' },
        { key: 'totalCustomers', schema: CustomerSchema, modelName: 'TrividaCustomer' },
        { key: 'totalActivities', schema: ActivitySchema, modelName: 'TrividaActivity' },
        { key: 'totalDebts', schema: DebtSchema, modelName: 'TrividaDebt' },
        { key: 'totalSavingsGoals', schema: SavingsGoalSchema, modelName: 'TrividaSavingsGoal' },
        { key: 'totalInvoices', schema: InvoiceSchema, modelName: 'TrividaInvoice' },
        { key: 'totalStocks', schema: StockSchema, modelName: 'TrividaStock' },
        { key: 'totalProducts', schema: ProductCatalogSchema, modelName: 'TrividaProductCatalog' },
        { key: 'totalBusinessProfiles', schema: BusinessProfileSchema, modelName: 'TrividaBusinessProfile' },
    ];
    
    const entityCounts = {};
    for (const config of entityConfigs) {
        try {
            const Model = getModel(APP_NAME, config.modelName, config.schema);
            entityCounts[config.key] = await Model.countDocuments({ deleted: { $ne: true } });
        } catch (e) {
            entityCounts[config.key] = 0;
        }
    }
    
    // ── Revenus ─────────────────────────────────────────────────────────────
    const PLAN_PRICES = { basic: 1500, premium: 3500 };
    const estimatedMonthlyRevenue = (basicUsers * PLAN_PRICES.basic) + (premiumUsers * PLAN_PRICES.premium);
    
    const expiringIn7Days = await User.countDocuments({
        premiumPlan: { $in: ['basic', 'premium'] },
        premiumUntil: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
    });
    
    return {
        date: startOfDay,
        totalUsers,
        activeUsers,
        newUsers,
        premiumUsers,
        basicUsers,
        freeUsers,
        deletedUsers,
        lockedUsers,
        usersSyncedToday,
        totalDeviceIds,
        totalAIRequests,
        usersWithAIRequests,
        usersQuotaReached,
        ...entityCounts,
        estimatedMonthlyRevenue,
        expiringIn7Days,
        calculatedAt: now,
    };
}

/**
 * Fonction principale du cron — calcule les métriques de la veille
 */
async function runMetricsSnapshot() {
    const startTime = Date.now();
    console.log(`\n📊 [MetricsCron] Début du calcul des métriques quotidiennes...`);
    
    try {
        // Calculer les métriques de la veille
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const metrics = await calculateMetricsForDate(yesterday);
        
        if (!metrics) {
            console.error(`[MetricsCron] Échec du calcul des métriques`);
            return;
        }
        
        // Upsert dans la collection (un document par jour)
        const MetricsDaily = getModel(APP_NAME, 'TrividaMetricsDaily', MetricsDailySchema);
        
        await MetricsDaily.findOneAndUpdate(
            { date: metrics.date },
            { $set: metrics },
            { upsert: true, new: true }
        );
        
        const duration = Date.now() - startTime;
        console.log(`✅ [MetricsCron] Métriques sauvegardées pour ${metrics.date.toISOString().split('T')[0]} (${duration}ms)`);
        console.log(`   Users: ${metrics.totalUsers} | Active: ${metrics.activeUsers} | New: ${metrics.newUsers} | Revenue: ${metrics.estimatedMonthlyRevenue} XAF`);
        
    } catch (error) {
        console.error(`❌ [MetricsCron] Erreur:`, error.message);
    }
}

/**
 * Programmer le cron job
 * S'exécute tous les jours à minuit (0 0 * * *)
 */
function startMetricsCron() {
    // Vérifier que le multi-tenant est initialisé
    try {
        getTenantDB(APP_NAME);
    } catch (e) {
        console.warn(`[MetricsCron] Base ${APP_NAME} pas encore prête, retry dans 10s...`);
        setTimeout(startMetricsCron, 10000);
        return;
    }
    
    cron.schedule('0 0 * * *', runMetricsSnapshot, {
        scheduled: true,
        timezone: 'Africa/Brazzaville',  // GMT+1
    });
    
    console.log(`⏰ [MetricsCron] Cron job démarré — exécution quotidienne à minuit (Africa/Brazzaville)`);
}

module.exports = { startMetricsCron, runMetricsSnapshot, calculateMetricsForDate };
