const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// Chargement des schémas Trivida
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

// Map nom d'entité → schéma
const SCHEMA_MAP = {
    transaction:      { modelName: 'TrividaTransaction',      schema: TransactionSchema },
    customer:         { modelName: 'TrividaCustomer',         schema: CustomerSchema },
    activity:         { modelName: 'TrividaActivity',         schema: ActivitySchema },
    debt:             { modelName: 'TrividaDebt',             schema: DebtSchema },
    savings_goal:     { modelName: 'TrividaSavingsGoal',      schema: SavingsGoalSchema },
    invoice:          { modelName: 'TrividaInvoice',          schema: InvoiceSchema },
    activity_recette: { modelName: 'TrividaActivityRecette',  schema: ActivityRecetteSchema },
    stock:            { modelName: 'TrividaStock',            schema: StockSchema },
    product_catalog:  { modelName: 'TrividaProductCatalog',   schema: ProductCatalogSchema },
    business_profile: { modelName: 'TrividaBusinessProfile',  schema: BusinessProfileSchema },
};

exports.SCHEMA_MAP = SCHEMA_MAP;

/**
 * Utilitaire — Obtenir le modèle MongoDB pour une entité
 */
function getModelForEntity(req, entity) {
    const entry = SCHEMA_MAP[entity];
    if (!entry) return null;
    try {
        return req.getModel(entry.modelName, entry.schema);
    } catch (error) {
        console.error(`[Sync] Modèle ${entry.modelName} non trouvé:`, error.message);
        return null;
    }
}

// ─── Push ─────────────────────────────────────────────────────────────────────
exports.push = asyncHandler(async (req, res) => {
    const { operations } = req.body;
    const userId = req.user._id;

    if (!operations || !Array.isArray(operations)) {
        throw new Error('Le champ operations est requis et doit être un tableau');
    }

    console.log(`📥 [Sync Push] ${operations.length} op(s) de l'utilisateur ${userId}`);

    const results = [];
    const errors  = [];

    for (const op of operations) {
        try {
            const { entity, localId, operation, payload } = op;

            const Model = getModelForEntity(req, entity);
            if (!Model) {
                errors.push({ entity, localId, error: 'Entité non supportée' });
                continue;
            }

            const dataWithUser = { ...payload, userId, localId };

            let result;
            if (operation === 'INSERT') {
                // Upsert pour éviter les doublons en cas de double push
                result = await Model.findOneAndUpdate(
                    { localId, userId },
                    { $set: dataWithUser },
                    { returnDocument: 'after', upsert: true }
                );
                results.push({ entity, localId, serverId: result._id, status: 'created' });

            } else if (operation === 'UPDATE') {
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : { localId, userId };

                result = await Model.findOneAndUpdate(
                    query,
                    { $set: dataWithUser },
                    { returnDocument: 'after', upsert: true }
                );
                results.push({ entity, localId, serverId: result._id, status: 'updated' });

            } else if (operation === 'DELETE') {
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : { localId, userId };

                // Soft delete — marque deleted:true au lieu de supprimer physiquement
                // Cela permet au pull de notifier les autres appareils de supprimer ce document
                await Model.findOneAndUpdate(
                    query,
                    { $set: { deleted: true, deletedAt: new Date() } },
                    { returnDocument: 'after' }
                );
                results.push({ entity, localId, status: 'deleted' });
            }
        } catch (error) {
            console.error(`[Sync Push] Erreur ${op.entity}:`, error.message);
            errors.push({ entity: op.entity, localId: op.localId, error: error.message });
        }
    }

    // Mettre à jour lastSyncAt de l'utilisateur
    try {
        const User = req.getModel('User');
        await User.findByIdAndUpdate(userId, { lastSyncAt: new Date() });
    } catch (e) {
        console.warn('[Sync] Impossible de mettre à jour lastSyncAt:', e.message);
    }

    console.log(`✅ [Sync Push] ${results.length} sync, ${errors.length} erreur(s)`);
    sendResponse(res, { results, errors, syncedCount: results.length }, 'Synchronisation terminée');
});

// ─── Pull ─────────────────────────────────────────────────────────────────────
exports.pull = asyncHandler(async (req, res) => {
    const { since } = req.query;
    const userId    = req.user._id;
    const sinceDate = since ? new Date(parseInt(since)) : null;

    console.log(`📤 [Sync Pull] depuis ${sinceDate || 'le début'} pour ${userId}`);

    const changes = [];

    for (const [entity, { modelName, schema }] of Object.entries(SCHEMA_MAP)) {
        try {
            const Model = req.getModel(modelName, schema);

            let docs;
            if (sinceDate) {
                // Pull incrémental : inclure les docs modifiés ET les soft-deleted récents
                // Model.collection bypasse le middleware pre-find pour accéder aux deleted:true
                const query = {
                    userId,
                    $or: [
                        { updatedAt: { $gte: sinceDate } },
                        { createdAt: { $gte: sinceDate } },
                        { deletedAt: { $gte: sinceDate } },
                    ],
                };
                docs = await Model.collection.find(query).limit(500).toArray();
            } else {
                // Pull complet : seulement les docs actifs (non supprimés)
                docs = await Model.find({ userId, deleted: { $ne: true } }).limit(500).lean();
            }
            docs.forEach(doc => {
                // S'assurer que localId est toujours présent dans data —
                // le client l'utilise pour mapper l'id local SQLite.
                // Si localId manque (doc créé directement en MongoDB),
                // on utilise le _id MongoDB converti en nombre comme fallback.
                const data = { ...doc };
                if (data.localId === undefined || data.localId === null) {
                    // Fallback : utiliser les 8 derniers caractères du _id en base 16
                    // pour générer un entier unique comme localId
                    const idStr = String(doc._id);
                    data.localId = parseInt(idStr.slice(-8), 16) || Date.now();
                }

                changes.push({
                    entity,
                    operation: doc.deleted ? 'DELETE' : 'INSERT',
                    data,
                    timestamp: doc.updatedAt || doc.createdAt,
                });
            });
        } catch (error) {
            console.error(`[Sync Pull] Erreur ${entity}:`, error.message);
        }
    }

    console.log(`✅ [Sync Pull] ${changes.length} modification(s) à envoyer`);
    sendResponse(res, changes, 'Modifications récupérées');
});

// ─── Stats ────────────────────────────────────────────────────────────────────
exports.stats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const stat   = {};

    for (const [entity, { modelName, schema }] of Object.entries(SCHEMA_MAP)) {
        try {
            const Model = req.getModel(modelName, schema);
            stat[entity] = await Model.countDocuments({ userId });
        } catch (e) {
            stat[entity] = 0;
        }
    }

    sendResponse(res, { ...stat, lastSync: req.user.lastSyncAt || null }, 'Statistiques de synchronisation');
});
