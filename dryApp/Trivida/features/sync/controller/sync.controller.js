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
// Clé unique de sync : { userId, localId, deviceId }.
// deviceId est optionnel coté client aujourd'hui (mobile n'envoie pas encore),
// mais le serveur l'accepte et le stocke pour préparer le multi-appareils.

// Le client envoie toujours localId en string ("1"). D'anciennes données (ou
// certains flux) peuvent avoir enregistré un localId numérique (1) côté serveur.
// MongoDB compare en égalité stricte → un DELETE/UPDATE en string ne matche pas
// → "Document introuvable" → le soft-delete n'est jamais appliqué → l'entité
// « revient » au pull suivant. On cherche donc sur toutes les variantes.
function idVariants(raw) {
    const out = [];
    const push = (v) => {
        if (v === null || v === undefined || v === '') return;
        out.push(v);
    };
    push(raw);
    if (typeof raw === 'string' && /^-?\d+$/.test(raw)) push(Number(raw));
    if (typeof raw === 'number' && Number.isFinite(raw)) push(String(raw));
    return out;
}

// Normalisation défensive du localId. Certains clients/legacy peuvent envoyer
// un objet "{ localId: '1' }" à la place d'un scalaire ("1" ou 1). Le champ est
// un Number dans les schémas → on extrait toujours un scalaire propre.
function normalizeLocalId(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'object') {
        const inner = raw.localId ?? raw.id ?? raw._id;
        return inner === undefined ? null : normalizeLocalId(inner);
    }
    return String(raw);
}

function localIdQuery(localId, userId, deviceId) {
    const variants = idVariants(localId);
    if (variants.length > 1) {
        const or = variants.map(v => ({ localId: v }));
        return { userId, $or: or, ...(deviceId ? { deviceId } : {}) };
    }
    return { userId, localId: variants[0] ?? null, ...(deviceId ? { deviceId } : {}) };
}

exports.push = asyncHandler(async (req, res) => {
    const { operations } = req.body;
    const userId = req.user._id;

    if (!operations || !Array.isArray(operations)) {
        throw new Error('Le champ operations est requis et doit être un tableau');
    }

    console.log(`📥 [Sync Push] ${operations.length} op(s) de l'utilisateur ${userId}`);

    const results = [];
    const errors  = [];
    let lastSyncAtUpdated = false;

    for (const op of operations) {
        try {
            const { entity, localId: rawLocalId, operation, payload } = op;
            const localId = normalizeLocalId(rawLocalId);
            if (localId === null) {
                errors.push({ entity, localId: rawLocalId, error: 'localId invalide ou manquant' });
                continue;
            }
            const deviceId = payload?.deviceId || null;

            const Model = getModelForEntity(req, entity);
            if (!Model) {
                errors.push({ entity, localId, error: 'Entité non supportée' });
                continue;
            }

            const dataWithUser = { ...payload, userId, localId, deviceId };

            let result;
            if (operation === 'INSERT') {
                // Pas d'upsert avec $or (non supporté par MongoDB) : on cherche
                // d'abord en tolérant les types, sinon on insère la clé canonique.
                const existing = await Model.findOne(localIdQuery(localId, userId, deviceId));
                if (existing) {
                    result = await Model.findOneAndUpdate(
                        { _id: existing._id },
                        { $set: dataWithUser },
                        { returnDocument: 'after' }
                    );
                } else {
                    result = await Model.findOneAndUpdate(
                        { localId, userId, deviceId },
                        { $set: dataWithUser },
                        { returnDocument: 'after', upsert: true }
                    );
                }
                results.push({ entity, localId, serverId: result._id, status: 'created' });

            } else if (operation === 'UPDATE') {
                // UPDATE : pas d'upsert. On s'attend à ce que le document existe.
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : localIdQuery(localId, userId, deviceId);

                const existing = await Model.findOne(query);
                if (!existing) {
                    errors.push({ entity, localId, error: 'Document introuvable pour UPDATE' });
                    continue;
                }

                const updated = await Model.findOneAndUpdate(
                    query,
                    { $set: dataWithUser },
                    { returnDocument: 'after' }
                );
                results.push({ entity, localId, serverId: updated._id, status: 'updated' });

            } else if (operation === 'DELETE') {
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : localIdQuery(localId, userId, deviceId);

                const existing = await Model.findOne(query);
                if (!existing) {
                    errors.push({ entity, localId, error: 'Document introuvable pour DELETE' });
                    continue;
                }

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

    // Mettre à jour lastSyncAt uniquement si au moins une opération a réussi.
    try {
        const User = req.getModel('User');
        if (results.length > 0) {
            await User.findByIdAndUpdate(userId, { lastSyncAt: new Date() });
            lastSyncAtUpdated = true;
        }
    } catch (e) {
        console.warn('[Sync] Impossible de mettre à jour lastSyncAt:', e.message);
    }

    console.log(`✅ [Sync Push] ${results.length} sync, ${errors.length} erreur(s)`);

    // Récompense parrainage : si ce push contient des transactions INSERT,
    // vérifier (en arrière-plan, non bloquant) si le filleul atteint le seuil
    // d'activité → le parrain reçoit son bonus IA.
    if (operations.some(op => op.entity === 'transaction' && op.operation === 'INSERT')) {
        require('../../referral/controller/referral.controller')
            .maybeActivateRewardForUser(userId)
            .catch(e => console.warn('[Sync] Récompense parrainage non vérifiée:', e.message));
    }

    sendResponse(res, { results, errors, syncedCount: results.length }, 'Synchronisation terminée');
});

// ─── Pull ─────────────────────────────────────────────────────────────────────
// Pull paginé : ?since=<timestamp>&limit=<n>&cursor=<lastDocTimestamp>
// - since : epoch ms du dernier pull connu (pull incrémental)
// - limit : max docs par entité (défaut 200, max 500)
// - cursor : timestamp brut du dernier doc reçu côté client (pour reprendre)
exports.pull = asyncHandler(async (req, res) => {
    const userId    = req.user._id;
    const sinceRaw  = req.query.since ? parseInt(req.query.since, 10) : null;
    const sinceDate = sinceRaw ? new Date(sinceRaw) : null;
    const limit     = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 20), 500);
    const cursor    = req.query.cursor ? new Date(parseInt(req.query.cursor, 10)) : null;

    console.log(`📤 [Sync Pull] userId=${userId} since=${sinceDate || 'le début'} limit=${limit} cursor=${cursor || 'aucun'}`);

    const changes = [];
    const meta    = { total: 0, entities: {} };

    const isIncremental = Boolean(sinceDate || cursor);

    for (const [entity, { modelName, schema }] of Object.entries(SCHEMA_MAP)) {
        try {
            const Model = req.getModel(modelName, schema);

            let baseQuery = { userId };
            if (!isIncremental) {
                baseQuery.deleted = { $ne: true };
            } else {
                baseQuery = {
                    userId,
                    $or: [
                        { updatedAt: { $gte: sinceDate || cursor } },
                        { createdAt: { $gte: sinceDate || cursor } },
                        { deletedAt: { $gte: sinceDate || cursor } },
                    ],
                };
            }

            // Compter avant de paginer (évitait auparavant le dépassement de 500)
            const totalForEntity = await Model.countDocuments(baseQuery);
            meta.total += totalForEntity;
            meta.entities[entity] = { total: totalForEntity, returned: 0 };

            const docs = await Model.find(baseQuery)
                .sort({ updatedAt: 1, createdAt: 1, _id: 1 })
                .limit(limit)
                .lean();

            meta.entities[entity].returned = docs.length;

            for (const doc of docs) {
                const data = { ...doc };

                // localId : privilégier celui stocké, fallback robuste sinon.
                // Le fallback est une représentation positive stable du _id MongoDB
                // (et non une collision-prone slice hex), pour limiter les collisions.
                if (data.localId === undefined || data.localId === null) {
                    if (doc._id && typeof doc._id === 'object' && doc._id.toString) {
                        const idStr = String(doc._id);
                        // Extraire une partie stable du _id (nonce + counter) puis hash
                        // pour un entier positif cohérent.
                        const digest = require('crypto').createHash('sha1').update(idStr).digest('hex');
                        const num = parseInt(digest.slice(0, 8), 16);
                        data.localId = (num >>> 0) || Date.now();
                    } else {
                        data.localId = Date.now();
                    }
                }

                changes.push({
                    entity,
                    operation: doc.deleted ? 'DELETE' : 'INSERT',
                    data,
                    cursor: doc.updatedAt ? doc.updatedAt.getTime() : (doc.createdAt?.getTime() || Date.now()),
                    timestamp: doc.updatedAt || doc.createdAt,
                });
            }
        } catch (error) {
            console.error(`[Sync Pull] Erreur ${entity}:`, error.message);
        }
    }

    console.log(`✅ [Sync Pull] ${changes.length} modification(s) à envoyer (total candidats: ${meta.total})`);
    sendResponse(res, { changes, meta }, 'Modifications récupérées');
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
