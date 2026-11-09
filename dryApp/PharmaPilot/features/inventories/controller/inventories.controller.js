const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const InventoriesSchema = require('../model/inventories.schema');
const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const ProductsSchema = require('../../products/model/products.schema');
const { validateInventory } = require('../service/inventories.service');
const { badRequest, notFound } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

const models = (req) => ({
  Inventory: req.getModel('Inventory', InventoriesSchema),
  Balance: req.getModel('StockBalance', StockBalancesSchema),
  Product: req.getModel('Product', ProductsSchema),
});

const POPULATE = [
  { path: 'categoryId', select: 'name' },
  { path: 'lines.productId', select: 'name sku unit form' },
  { path: 'lines.lotId', select: 'lotNumber expiryDate' },
];

const lineKey = (productId, lotId) => `${String(productId)}:${lotId ? String(lotId) : ''}`;

/** LISTE paginee des sessions d'inventaire. */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste des inventaires', true, pagination || undefined);
});

/** DETAIL d'un inventaire. */
exports.getOne = asyncHandler(async (req, res) => {
  const { Inventory } = models(req);
  const doc = await Inventory.findOne(tenantFilter(req, { _id: req.params.id })).populate(POPULATE);
  if (!doc) throw notFound('Inventaire introuvable');
  return sendResponse(res, doc, 'Inventaire recupere');
});

/**
 * CREATE — ouvre une session et fige les quantites theoriques.
 * `full` couvre tous les soldes de la pharmacie ; `partial` se restreint a une
 * categorie de produits.
 */
exports.create = asyncHandler(async (req, res) => {
  const { Inventory, Balance, Product } = models(req);
  if (!req.pharmacyId) throw badRequest('Aucune pharmacie active pour ouvrir un inventaire');

  const { scope = 'full', categoryId = null, note } = req.body;

  const balanceMatch = { pharmacyId: req.pharmacyId };

  if (scope === 'partial') {
    if (!categoryId) throw badRequest('Une categorie est requise pour un inventaire partiel');
    const products = await Product.find({ pharmacyId: req.pharmacyId, categoryId }).select('_id');
    balanceMatch.productId = { $in: products.map((p) => p._id) };
  }

  const balances = await Balance.find(balanceMatch);
  const lines = balances
    .filter((b) => (b.quantityOnHand || 0) !== 0)
    .map((b) => ({
      productId: b.productId,
      lotId: b.lotId || null,
      theoreticalQuantity: b.quantityOnHand,
      countedQuantity: null,
      difference: 0,
    }));

  const doc = await Inventory.create({
    tenantId: req.tenantId,
    pharmacyId: req.pharmacyId,
    scope,
    categoryId: scope === 'partial' ? categoryId : null,
    // Gel des theoriques : les mouvements restent autorises apres cet instant
    // et seront pris en compte au moment du calcul des ecarts.
    snapshotAt: new Date(),
    note: note || null,
    status: 'draft',
    lines,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  const created = await Inventory.findById(doc._id).populate(POPULATE);
  return sendResponse(res, created, 'Inventaire ouvert', true, undefined, 201);
});

/** UPDATE LINES — saisie des comptages (inventaire encore ouvert). */
exports.updateLines = asyncHandler(async (req, res) => {
  const { Inventory } = models(req);
  const inventory = await Inventory.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!inventory) throw notFound('Inventaire introuvable');
  if (inventory.status !== 'draft') throw badRequest('Un inventaire cloture ne peut plus etre modifie');

  const incoming = new Map(
    (req.body.lines || []).map((l) => [lineKey(l.productId, l.lotId), l])
  );

  inventory.lines.forEach((line) => {
    const update = incoming.get(lineKey(line.productId, line.lotId));
    if (!update) return;
    line.countedQuantity = update.countedQuantity;
    if (update.justification !== undefined) line.justification = update.justification;
    line.difference = update.countedQuantity - line.theoreticalQuantity;
  });

  inventory.updatedBy = req.user._id;
  inventory.markModified('lines');
  await inventory.save();

  const refreshed = await Inventory.findById(inventory._id).populate(POPULATE);
  return sendResponse(res, refreshed, 'Comptages enregistres');
});

/** VALIDATE — genere les ajustements traces (transactionnel). */
exports.validate = asyncHandler(async (req, res) => {
  const { Inventory } = models(req);
  await validateInventory(req);
  const refreshed = await Inventory.findById(req.params.id).populate(POPULATE);
  return sendResponse(res, refreshed, 'Inventaire valide : ajustements enregistres');
});

/** CANCEL — abandon d'une session ouverte. */
exports.cancel = asyncHandler(async (req, res) => {
  const { Inventory } = models(req);
  const inventory = await Inventory.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!inventory) throw notFound('Inventaire introuvable');
  if (inventory.status === 'validated') {
    throw badRequest('Un inventaire valide ne peut pas etre annule : creez les contre-mouvements necessaires');
  }
  if (inventory.status === 'cancelled') return sendResponse(res, inventory, 'Inventaire deja annule');

  inventory.status = 'cancelled';
  inventory.updatedBy = req.user._id;
  await inventory.save();
  return sendResponse(res, inventory, 'Inventaire annule');
});
