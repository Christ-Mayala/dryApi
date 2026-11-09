const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const StockMovementsSchema = require('../model/stockMovements.schema');
const StockBalancesSchema = require('../model/stockBalances.schema');
const LotsSchema = require('../../lots/model/lots.schema');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const { postMovement } = require('../../../lib/stock.service');
const { runAtomic } = require('../../../lib/atomic');
const { findExisting, remember } = require('../../../lib/idempotency');
const { badRequest, notFound, conflict } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

/**
 * Journal des mouvements de stock.
 *
 * Regles :
 *  - Un mouvement n'est jamais modifie ni supprime (pas de PUT/DELETE) :
 *    toute correction passe par un contre-mouvement.
 *  - Les entrees proviennent exclusivement du flux de reception ; une entree
 *    manuelle est refusee.
 *  - Une sortie exige un lot explicite (tracabilite + suggestion FEFO cote UI).
 */

const OUT_REASONS = ['sale', 'loss', 'breakage', 'donation', 'return_supplier', 'return_customer', 'expiry'];

const models = (req) => ({
  Movement: req.getModel('StockMovement', StockMovementsSchema),
  Balance: req.getModel('StockBalance', StockBalancesSchema),
  Lot: req.getModel('Lot', LotsSchema),
  Pharmacy: req.getModel('Pharmacy', PharmaciesSchema),
});

const POPULATE = [
  { path: 'productId', select: 'name sku unit form' },
  { path: 'lotId', select: 'lotNumber expiryDate' },
  { path: 'actorId', select: 'name email' },
];

/** LISTE — journal filtre (produit, type, motif, periode) et pagine. */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Journal des mouvements', true, pagination || undefined);
});

/** DETAIL d'un mouvement. */
exports.getOne = asyncHandler(async (req, res) => {
  const { Movement } = models(req);
  const doc = await Movement.findOne(tenantFilter(req, { _id: req.params.id })).populate(POPULATE);
  if (!doc) throw notFound('Mouvement introuvable');
  return sendResponse(res, doc, 'Mouvement recupere');
});

/** CREATE — sortie ou ajustement manuel (jamais une entree). */
exports.create = asyncHandler(async (req, res) => {
  const { Movement, Balance, Lot, Pharmacy } = models(req);
  const { productId, lotId = null, type = 'out', quantity, sign, reasonCode, reason, note, occurredAt } = req.body;

  if (!req.pharmacyId) throw badRequest('Aucune pharmacie active pour enregistrer un mouvement');
  if (type === 'in') throw badRequest('Une entree de stock se cree uniquement via une reception fournisseur');
  if (type === 'out' && !OUT_REASONS.includes(reasonCode)) throw badRequest('Motif de sortie invalide');
  if (type === 'adjustment' && reasonCode !== 'correction') {
    throw badRequest("Un ajustement manuel doit porter le motif 'correction'");
  }
  if (type === 'out' && !lotId) throw badRequest('Un lot est requis pour une sortie (tracabilite par lot)');

  if (lotId) {
    const lot = await Lot.findOne(tenantFilter(req, { _id: lotId }));
    if (!lot) throw notFound('Lot introuvable');
    if (String(lot.productId) !== String(productId)) throw badRequest('Le lot ne correspond pas au produit');
    if (lot.quarantined) throw conflict('Le lot est en quarantaine : sortie refusee');
  }

  // Stock negatif refuse par defaut ; reglage porté par la pharmacie.
  const pharmacy = await Pharmacy.findById(req.pharmacyId);
  const allowNegative = Boolean(pharmacy?.settings?.allowNegativeStock);

  // Idempotence : rejouer la meme requete ne doit pas dupliquer le mouvement.
  const existing = await findExisting(req);
  if (existing?.responseRef) {
    return sendResponse(res, existing.responseRef, 'Mouvement deja enregistre');
  }

  const result = await runAtomic(Movement.db, async (session) => {
    const { movement, balance } = await postMovement({
      Movement,
      Balance,
      pharmacyId: req.pharmacyId,
      tenantId: req.tenantId,
      productId,
      lotId,
      type,
      quantity,
      sign: type === 'adjustment' ? sign : -1,
      reasonCode,
      reason,
      sourceType: 'manual',
      sourceId: null,
      actorId: req.user._id,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      note,
      allowNegative,
      session,
    });
    return { movement: movement.toObject(), balanceAfter: balance.quantityOnHand };
  });

  await remember(req, result);
  return sendResponse(res, result, 'Mouvement enregistre', true, undefined, 201);
});
