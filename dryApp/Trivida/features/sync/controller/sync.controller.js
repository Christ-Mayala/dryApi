const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const crypto = require('crypto');

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

// ─── Push helpers ─────────────────────────────────────────────────────────────

// Normalisation défensive du localId
function normalizeLocalId(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'object') {
        const inner = raw.localId ?? raw.id ?? raw._id;
        return inner === undefined ? null : normalizeLocalId(inner);
    }
    return String(raw);
}

// Toutes les variantes scalaire d'un localId (number/string) pour matcher
// l'ancienne base de données côté serveur où le type peut être différent.
function idVariants(raw) {
    const out = [];
    const push = (v) => {
        if (v === null || v === undefined || v === '') return;
        out.push(v);
    };
    push(raw);
    if (typeof raw === 'string' && /^-?\d+$/.test(raw)) push(Number(raw));
    if (typeof raw === 'number' && Number.isFinite(raw)) push(String(raw));
    return [...new Set(out)];
}

// ── Comparaison de contenu ─────────────────────────────────────────────────────
// Compare deux documents (doc = document stocké, payload = dataWithUser côté client)
// pour décider s'il s'agit du MÊME enregistrement (ré-écriture/idempotence) ou
// de DEUX enregistrements distincts ayant un même localId (conflit inter-appareils).

const COMPARE_SKIP_KEYS = new Set([
    '_id', 'userId', 'localId', 'deviceId', 'id', 'aliases',
    'deleted', 'deletedAt', 'updatedAt', 'createdAt', 'synced', 'serverId',
]);

function normalizeVal(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'object' && v && typeof v.getTime === 'function') return v.getTime();
    if (typeof v === 'string' && /^\d+$/.test(v) && v.length <= 15) return Number(v);
    return v;
}

function equiv(a, b) {
    const na = normalizeVal(a);
    const nb = normalizeVal(b);
    if (na === nb) return true;
    if (na === null && nb === null) return true;
    if (na === null || nb === null) return false;
    if (typeof na === 'number' && typeof nb === 'number') {
        return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 1e-9;
    }
    return String(na) === String(nb);
}

/**
 * Renvoie true si le contenu de `doc` correspond à `incoming`.
 * Ignore les métadonnées (userId, localId, timestamps, etc.).
 */
function contentEquals(doc, incoming) {
    if (!doc || !incoming) return false;
    const incomingKeys = Object.keys(incoming).filter(k => !COMPARE_SKIP_KEYS.has(k));
    if (incomingKeys.length === 0) return false;
    for (const k of incomingKeys) {
        if (doc[k] === undefined) continue; // champ absent côté serveur (legacy / whitelist)
        if (!equiv(doc[k], incoming[k])) return false;
    }
    return true;
}

// ── Recherche de documents candidats (localId OU aliases) ─────────────────────
// Cherche dans une collection toutes les lignes dont le localId OU un alias
// correspond aux variantes du localId demandé. Ne retourne JAMAIS les docs
// soft-deletés (suppression par le pre-find hook).

async function findCandidates(Model, userId, variants) {
    const clauses = [{ localId: { $in: variants } }];
    for (const v of variants) clauses.push({ aliases: v });
    return Model.find({ userId, $or: clauses }).lean();
}

// ── Allouer un localId unique (anti-collision) ────────────────────────────────
// Dérivé de sha1(originalLocalId:userId:deviceId) → entier positif 32 bits.
// En cas de collision (probabilité ≈ 1e-7), on progresse via LCG borné.

function hashLocalId(original, userId, deviceId) {
    const seed = String(original) + ':' + String(userId) + ':' + String(deviceId || '');
    const digest = crypto.createHash('sha1').update(seed).digest('hex');
    return (parseInt(digest.slice(0, 8), 16) >>> 0) || 1;
}

async function allocateUniqueLocalId(Model, userId, original, deviceId) {
    let candidate = hashLocalId(original, userId, deviceId);
    let guard = 50;
    while (guard-- > 0) {
        const exists = await Model.findOne({
            userId,
            $or: [{ localId: candidate }, { aliases: String(candidate) }],
        }).select('_id').lean();
        if (!exists) break;
        candidate = ((candidate * 2654435761) >>> 0) || 1; // LCG borné, évite 0
    }
    return candidate;
}

// ── Invoice : unicité du numéro par utilisateur ───────────────────────────────
// Au sein des factures non supprimées d'un même utilisateur, on garantit que
// deux live factures ne partagent pas le même `invoiceNumber` — sinon
// l'INSERT OR REPLACE côté client (SQLite UNIQUE) échouerait en pull.

async function nextFreeInvoiceNumber(req, Model, userId, baseNumber, excludeId, takenNumbers) {
    if (baseNumber === undefined || baseNumber === null) return baseNumber;
    const str = String(baseNumber);
    let candidate = str;
    let n = 2;
    const guard = 500;
    while (n <= guard) {
        const inMemoryTaken = takenNumbers && takenNumbers.has(candidate);
        if (!inMemoryTaken) {
            const taken = await Model.findOne({
                userId,
                invoiceNumber: candidate,
                ...(excludeId ? { _id: { $ne: excludeId } } : {}),
            }).select('_id').lean();
            if (!taken) break;
        }
        candidate = `${str}-${n}`;
        n++;
    }
    return candidate;
}

// ─── Push ─────────────────────────────────────────────────────────────────────
// Clé unique de sync : { userId, localId, deviceId }.
// deviceId est optionnel côté client aujourd'hui (mobile n'envoie pas encore
// systématiquement), mais le serveur l'accepte et le stocke.

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
            const variants = idVariants(localId);

            // ── INSERT ──────────────────────────────────────────────────────
            if (operation === 'INSERT') {
                const candidates = await findCandidates(Model, userId, variants);
                const sameRecord = candidates.find(d => contentEquals(d, dataWithUser));

                if (sameRecord) {
                    // Idempotence ou ré-écriture du MÊME enregistrement →
                    // on met à jour en conservant le localId canonique existant.
                    const updated = await Model.findOneAndUpdate(
                        { _id: sameRecord._id },
                        { $set: dataWithUser },
                        { returnDocument: 'after' }
                    );
                    results.push({ entity, localId, serverId: updated._id, status: 'created' });

                    // Invoice : garantir unicité du numéro même sur mise à jour
                    if (entity === 'invoice' && dataWithUser.invoiceNumber) {
                        await Model.updateOne(
                            { _id: updated._id },
                            { $set: { invoiceNumber: await nextFreeInvoiceNumber(req, Model, userId, dataWithUser.invoiceNumber, updated._id) } }
                        );
                    }

                } else if (candidates.length > 0) {
                    // ╔═══════════════════════════════════════════════════════╗
                    // ║  COLLISION INTER-APPAREILS (différent contenu)       ║
                    // ║  → On préserve les DEUX enregistrements.            ║
                    // ║  → Le nouveau document reçoit un localId unique       ║
                    // ║    dérivé de sha1 pour ne pas écraser l'original.     ║
                    // ║  → Le localId original est stocké dans `aliases`      ║
                    // ║    pour que les futurs UPDATE/DELETE retrouvent bien   ║
                    // ║    le bon document via ce localId.                   ║
                    // ╚═══════════════════════════════════════════════════════╝
                    const newLocalId = await allocateUniqueLocalId(Model, userId, localId, deviceId);
                    const created = await Model.findOneAndUpdate(
                        { localId: newLocalId, userId, deviceId },
                        { $set: { ...dataWithUser, localId: newLocalId },
                          $addToSet: { aliases: String(localId) } },
                        { returnDocument: 'after', upsert: true }
                    );
                    // echo le localId ORIGINAL pour que l'app confirme l'op
                    // (confirmedKeys se base sur `entity|localId` côté client)
                    results.push({ entity, localId, serverId: created._id, status: 'created', reassignedLocalId: newLocalId });

                    // Invoice : garantir unicité
                    if (entity === 'invoice' && dataWithUser.invoiceNumber) {
                        await Model.updateOne(
                            { _id: created._id },
                            { $set: { invoiceNumber: await nextFreeInvoiceNumber(req, Model, userId, dataWithUser.invoiceNumber, created._id) } }
                        );
                    }

                } else {
                    // Nouveau document → insert upsert classique
                    const created = await Model.findOneAndUpdate(
                        { localId: variants[0] ?? localId, userId, deviceId },
                        { $set: dataWithUser },
                        { returnDocument: 'after', upsert: true }
                    );
                    results.push({ entity, localId, serverId: created._id, status: 'created' });

                    if (entity === 'invoice' && dataWithUser.invoiceNumber) {
                        await Model.updateOne(
                            { _id: created._id },
                            { $set: { invoiceNumber: await nextFreeInvoiceNumber(req, Model, userId, dataWithUser.invoiceNumber, created._id) } }
                        );
                    }
                }

            // ── UPDATE ─────────────────────────────────────────────────────
            } else if (operation === 'UPDATE') {
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : { userId, $or: [{ localId: { $in: variants } }, { aliases: { $in: variants } }] };

                let existing;
                if (payload.serverId) {
                    existing = await Model.findOne(query);
                } else {
                    const candidates = await Model.find(query).lean();
                    // Préférer le document dont le contenu correspond à l'incoming
                    existing = candidates.find(d => contentEquals(d, dataWithUser)) || candidates[0] || null;
                    if (existing) existing = await Model.findOne({ _id: existing._id });
                }

                if (!existing) {
                    errors.push({ entity, localId, error: 'Document introuvable pour UPDATE' });
                    continue;
                }

                const updated = await Model.findOneAndUpdate(
                    { _id: existing._id },
                    { $set: dataWithUser },
                    { returnDocument: 'after' }
                );
                results.push({ entity, localId, serverId: updated._id, status: 'updated' });

                if (entity === 'invoice' && dataWithUser.invoiceNumber) {
                    await Model.updateOne(
                        { _id: updated._id },
                        { $set: { invoiceNumber: await nextFreeInvoiceNumber(req, Model, userId, dataWithUser.invoiceNumber, updated._id) } }
                    );
                }

            // ── DELETE ─────────────────────────────────────────────────────
            } else if (operation === 'DELETE') {
                const query = payload.serverId
                    ? { _id: payload.serverId, userId }
                    : { userId, $or: [{ localId: { $in: variants } }, { aliases: { $in: variants } }] };

                let existing;
                if (payload.serverId) {
                    existing = await Model.findOne(query);
                } else {
                    const candidates = await Model.find(query).lean();
                    // Pour un DELETE sans serverId, préférer le doc dont
                    // localId correspond exactement (propriétaire original)
                    existing = candidates.find(d => variants.includes(d.localId)) || candidates[0] || null;
                    if (existing) existing = await Model.findOne({ _id: existing._id });
                }

                if (!existing) {
                    errors.push({ entity, localId, error: 'Document introuvable pour DELETE' });
                    continue;
                }

                await Model.findOneAndUpdate(
                    { _id: existing._id },
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

    // Récompense parrainage
    if (operations.some(op => op.entity === 'transaction' && op.operation === 'INSERT')) {
        require('../../referral/controller/referral.controller')
            .maybeActivateRewardForUser(userId)
            .catch(e => console.warn('[Sync] Récompense parrainage non vérifiée:', e.message));
    }

    sendResponse(res, { results, errors, syncedCount: results.length }, 'Synchronisation terminée');
});

// ─── Pull ─────────────────────────────────────────────────────────────────────

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

            const totalForEntity = await Model.countDocuments(baseQuery);
            meta.total += totalForEntity;
            meta.entities[entity] = { total: totalForEntity, returned: 0 };

            const docs = await Model.find(baseQuery)
                .sort({ updatedAt: 1, createdAt: 1, _id: 1 })
                .limit(limit)
                .lean();

            meta.entities[entity].returned = docs.length;

            // Pour les factures : déduplication `invoiceNumber` dans la réponse
            // afin que le client SQLite UNIQUE ne soit jamais violé.
            const seenInvoiceNumbers = entity === 'invoice' ? new Set() : null;

            for (const doc of docs) {
                const data = { ...doc };

                // localId fallback (stable, basé sur _id)
                if (data.localId === undefined || data.localId === null) {
                    if (doc._id && typeof doc._id === 'object' && doc._id.toString) {
                        const idStr = String(doc._id);
                        const digest = crypto.createHash('sha1').update(idStr).digest('hex');
                        const num = parseInt(digest.slice(0, 8), 16);
                        data.localId = (num >>> 0) || Date.now();
                    } else {
                        data.localId = Date.now();
                    }
                }

                // Invoice deduplication : renommer dans la réponse ET persister
                // pour que les pulls futurs restent cohérents.
                if (seenInvoiceNumbers && data.invoiceNumber !== null && data.invoiceNumber !== undefined) {
                    let number = String(data.invoiceNumber);
                    if (seenInvoiceNumbers.has(number)) {
                        number = await nextFreeInvoiceNumber(req, Model, userId, number, doc._id, seenInvoiceNumbers);
                        // Persister au mieux-effort (best effort)
                        if (number !== String(data.invoiceNumber)) {
                            await Model.updateOne(
                                { _id: doc._id },
                                { $set: { invoiceNumber: number } }
                            ).catch(() => {});
                        }
                    }
                    seenInvoiceNumbers.add(number);
                    data.invoiceNumber = number;
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
