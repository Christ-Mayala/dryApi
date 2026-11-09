const mongoose = require('mongoose');
const { conflict, badRequest } = require('./errors');

/**
 * Moteur de stock PharmaPilot — source unique de verite pour toute variation.
 *
 * Regles non negociables appliquees ici :
 *  - Aucune variation de stock sans mouvement correspondant (jamais de mise a
 *    jour directe d'un solde).
 *  - Jamais de stock negatif (sauf ajustement d'inventaire explicitement motive
 *    et autorise).
 *  - Toute operation multi-documents s'execute dans la meme session Mongo.
 *  - `stockBalances` est une projection du journal `stockMovements` : elle doit
 *    rester rapprochable a tout moment.
 */

/** Convertit une valeur en ObjectId Mongo ou null. */
const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};

/**
 * Applique un mouvement de stock atomiquement (ecriture du mouvement +
 * mise a jour du solde correspondant).
 *
 * @param {object} ctx
 * @param {import('mongoose').Model} ctx.Movement  - modele StockMovement
 * @param {import('mongoose').Model} ctx.Balance   - modele StockBalance
 * @param {string|object} ctx.pharmacyId           - etablissement (cle du solde)
 * @param {string|object} [ctx.tenantId]           - organisation proprietaire
 * @param {string} ctx.productId
 * @param {string|null} ctx.lotId
 * @param {'in'|'out'|'adjustment'} ctx.type
 * @param {number} ctx.quantity                    - quantite toujours positive
 * @param {number} ctx.sign                        - +1 entree, -1 sortie, +/-1 ajustement
 * @param {string} ctx.reasonCode
 * @param {string} [ctx.reason]
 * @param {string} ctx.sourceType
 * @param {string|null} [ctx.sourceId]
 * @param {string|null} [ctx.actorId]
 * @param {Date}   [ctx.occurredAt]
 * @param {string} [ctx.note]
 * @param {boolean} [ctx.allowNegative=false]
 * @param {import('mongoose').ClientSession|null} [ctx.session]
 * @returns {Promise<{ movement: object, balance: object }>}
 */
const postMovement = async (ctx) => {
  const {
    Movement,
    Balance,
    pharmacyId,
    tenantId = null,
    productId,
    lotId = null,
    type,
    quantity,
    sign,
    reasonCode,
    reason,
    sourceType,
    sourceId = null,
    actorId = null,
    occurredAt = new Date(),
    note,
    allowNegative = false,
    session = null,
  } = ctx;

  if (!['in', 'out', 'adjustment'].includes(type)) throw badRequest('Type de mouvement invalide');
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw badRequest('La quantite doit etre strictement positive');
  const signedQuantity = type === 'adjustment' ? Number(sign) * qty : (type === 'in' ? qty : -qty);
  if (type !== 'in' && ![-1, 1].includes(Number(sign))) {
    if (type === 'out' && Number(sign) !== -1) throw badRequest('Signe de sortie invalide');
  }

  // Le solde est cle par ETABLISSEMENT (pharmacyId) : deux pharmacies d'une
  // meme organisation ne partagent jamais un solde.
  const balanceQuery = { pharmacyId: toObjectId(pharmacyId), productId: toObjectId(productId), lotId: toObjectId(lotId) };
  if (!balanceQuery.pharmacyId) throw badRequest('pharmacyId invalide');
  if (!balanceQuery.productId) throw badRequest('productId invalide');

  let findQuery = Balance.findOne(balanceQuery);
  if (session) findQuery = findQuery.session(session);
  let balance = await findQuery;

  const current = balance ? balance.quantityOnHand : 0;
  const next = current + signedQuantity;

  if (next < 0 && !allowNegative) {
    throw conflict('Stock insuffisant : la sortie rendrait le solde negatif', {
      lotId: lotId || null,
      disponible: current,
      demande: qty,
    });
  }

  if (!balance) {
    balance = new Balance({
      ...balanceQuery,
      tenantId: toObjectId(tenantId),
      quantityOnHand: 0,
      quantityReserved: 0,
    });
  }
  balance.quantityOnHand = next;
  balance.lastMovementAt = occurredAt;
  await balance.save({ session: session || undefined });

  const movementPayload = {
    tenantId: toObjectId(tenantId),
    pharmacyId: balanceQuery.pharmacyId,
    productId: balanceQuery.productId,
    lotId: balanceQuery.lotId,
    type,
    quantity: qty,
    signedQuantity,
    reasonCode,
    reason: reason || reasonCode,
    sourceType,
    sourceId: toObjectId(sourceId),
    actorId: toObjectId(actorId),
    occurredAt,
    note,
    balanceAfter: next,
  };

  const created = await Movement.create([movementPayload], { session: session || undefined });
  return { movement: created[0], balance };
};

/**
 * Recalcule le solde theorique d'un lot a partir du journal des mouvements.
 * Sert au rapprochement (stockBalances vs stockMovements).
 *
 * `Stock = Σ Mouvements valides` : c'est cette somme qui fait foi, le solde
 * n'etant qu'une projection d'acceleration des lectures.
 */
const computeJournalBalance = async (Movement, pharmacyId, productId, lotId = null) => {
  const match = {
    pharmacyId: toObjectId(pharmacyId),
    productId: toObjectId(productId),
    lotId: toObjectId(lotId),
    status: { $ne: 'deleted' },
  };
  const rows = await Movement.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$signedQuantity' } } },
  ]);
  return rows.length ? rows[0].total : 0;
};

module.exports = { postMovement, computeJournalBalance, toObjectId };
