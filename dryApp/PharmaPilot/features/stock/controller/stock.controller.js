const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const StockMovementsSchema = require('../../movements/model/stockMovements.schema');
const LotsSchema = require('../../lots/model/lots.schema');
const ProductsSchema = require('../../products/model/products.schema');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const { computeJournalBalance, toObjectId } = require('../../../lib/stock.service');
const { badRequest, notFound } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

/**
 * Consultation du stock.
 *
 * Le stock n'est jamais lu ailleurs que dans `stockBalances` (projection du
 * journal). La vue par lot applique la regle FEFO (premier perime, premier
 * sorti) pour suggerer l'ordre de sortie, sans imposer de mouvement.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const ensureObjectId = (value, label) => {
  if (!toObjectId(value)) throw badRequest(`${label} invalide`);
  return new mongoose.Types.ObjectId(String(value));
};

/** VUE GLOBALE — quantites par produit, stock faible et peremptions. */
exports.getOverview = asyncHandler(async (req, res) => {
  const Balance = req.getModel('StockBalance', StockBalancesSchema);
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);

  const pharmacy = req.pharmacyId ? await Pharmacy.findById(req.pharmacyId) : null;
  const lowStockThreshold = pharmacy?.settings?.lowStockThreshold ?? 10;
  const expiryAlertDays = pharmacy?.settings?.expiryAlertDays ?? 90;
  const now = new Date();
  const expiryLimit = new Date(now.getTime() + expiryAlertDays * DAY_MS);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const match = { status: { $ne: 'deleted' } };
  if (req.pharmacyId) match.pharmacyId = new mongoose.Types.ObjectId(String(req.pharmacyId));
  else if (Array.isArray(req.user?.pharmacyIds) && req.user.pharmacyIds.length && !req.isGlobalScope) {
    match.pharmacyId = { $in: req.user.pharmacyIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  }

  const productMatch = { 'product.status': { $ne: 'deleted' } };
  if (req.query.categoryId && toObjectId(req.query.categoryId)) {
    productMatch['product.categoryId'] = new mongoose.Types.ObjectId(String(req.query.categoryId));
  }
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    productMatch.$or = [{ 'product.name': rx }, { 'product.sku': rx }, { 'product.barcode': rx }];
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'lots',
        localField: 'lotId',
        foreignField: '_id',
        as: 'lot',
      },
    },
    {
      $addFields: {
        expiryDate: { $arrayElemAt: ['$lot.expiryDate', 0] },
        quarantined: { $ifNull: [{ $arrayElemAt: ['$lot.quarantined', 0] }, false] },
      },
    },
    {
      $group: {
        _id: '$productId',
        quantityOnHand: { $sum: '$quantityOnHand' },
        lotsCount: { $sum: { $cond: [{ $gt: ['$quantityOnHand', 0] }, 1, 0] } },
        expiringQuantity: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$quantityOnHand', 0] },
                  { $gte: ['$expiryDate', now] },
                  { $lte: ['$expiryDate', expiryLimit] },
                ],
              },
              '$quantityOnHand',
              0,
            ],
          },
        },
        expiredQuantity: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$quantityOnHand', 0] }, { $lt: ['$expiryDate', now] }] },
              '$quantityOnHand',
              0,
            ],
          },
        },
        lastMovementAt: { $max: '$lastMovementAt' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
    { $match: productMatch },
    {
      $addFields: {
        reorderThreshold: { $ifNull: ['$product.reorderThreshold', lowStockThreshold] },
        minStock: { $ifNull: ['$product.minStock', lowStockThreshold] },
      },
    },
    {
      $addFields: {
        isOutOfStock: { $lte: ['$quantityOnHand', 0] },
        isLowStock: {
          $and: [
            { $gt: ['$quantityOnHand', 0] },
            { $lte: ['$quantityOnHand', { $ifNull: ['$reorderThreshold', lowStockThreshold] }] },
          ],
        },
      },
    },
  ];

  if (req.query.lowStock === 'true') pipeline.push({ $match: { isLowStock: true } });
  if (req.query.outOfStock === 'true') pipeline.push({ $match: { isOutOfStock: true } });

  pipeline.push(
    { $sort: { 'product.name': 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: 'total' }],
      },
    }
  );

  const [result] = await Balance.aggregate(pipeline);
  const rows = (result?.data || []).map((r) => ({
    productId: r._id,
    name: r.product?.name,
    sku: r.product?.sku,
    form: r.product?.form,
    unit: r.product?.unit,
    barcode: r.product?.barcode,
    categoryId: r.product?.categoryId,
    quantityOnHand: r.quantityOnHand,
    lotsCount: r.lotsCount,
    expiringQuantity: r.expiringQuantity,
    expiredQuantity: r.expiredQuantity,
    reorderThreshold: r.reorderThreshold,
    minStock: r.minStock,
    isLowStock: r.isLowStock,
    isOutOfStock: r.isOutOfStock,
    lastMovementAt: r.lastMovementAt,
  }));

  const total = result?.meta?.[0]?.total || 0;
  const pagination = {
    total,
    count: rows.length,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  if (page * limit < total) pagination.next = { page: page + 1, limit };
  if (skip > 0) pagination.prev = { page: page - 1, limit };

  return sendResponse(res, rows, 'Etat du stock', true, pagination);
});

/** DETAIL PAR PRODUIT — total + repartition par lot (ordre FEFO). */
exports.getProductStock = asyncHandler(async (req, res) => {
  const productId = ensureObjectId(req.params.productId, 'Identifiant produit');
  const Product = req.getModel('Product', ProductsSchema);
  const Balance = req.getModel('StockBalance', StockBalancesSchema);

  const product = await Product.findOne(tenantFilter(req, { _id: productId })).populate({
    path: 'categoryId',
    select: 'name',
  });
  if (!product) throw notFound('Produit introuvable');

  const balances = await Balance.find(tenantFilter(req, { productId })).populate({
    path: 'lotId',
    select: 'lotNumber expiryDate receivedAt quarantined',
  });

  const lots = balances
    .map((b) => ({
      lotId: b.lotId?._id || null,
      lotNumber: b.lotId?.lotNumber || null,
      expiryDate: b.lotId?.expiryDate || null,
      quarantined: Boolean(b.lotId?.quarantined),
      expired: b.lotId?.expiryDate ? b.lotId.expiryDate.getTime() < Date.now() : false,
      quantityOnHand: b.quantityOnHand,
      lastMovementAt: b.lastMovementAt,
    }))
    .sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

  const total = lots.reduce((sum, l) => sum + (l.quantityOnHand || 0), 0);

  return sendResponse(
    res,
    { product, total, lots },
    'Stock du produit (ordre FEFO)'
  );
});

/** LOTS D'UN PRODUIT — sugggestion de sortie FEFO. */
exports.getProductLots = asyncHandler(async (req, res) => {
  const productId = ensureObjectId(req.params.productId, 'Identifiant produit');
  const Balance = req.getModel('StockBalance', StockBalancesSchema);

  const balances = await Balance.find(tenantFilter(req, { productId }))
    .populate({ path: 'lotId', select: 'lotNumber expiryDate receivedAt quarantined' })
    .sort('lastMovementAt');

  const lots = balances
    .filter((b) => b.lotId)
    .map((b) => ({
      lotId: b.lotId._id,
      lotNumber: b.lotId.lotNumber,
      expiryDate: b.lotId.expiryDate,
      quarantined: Boolean(b.lotId.quarantined),
      expired: b.lotId.expiryDate ? b.lotId.expiryDate.getTime() < Date.now() : false,
      quantityOnHand: b.quantityOnHand,
    }))
    .filter((l) => l.quantityOnHand > 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  return sendResponse(res, lots, 'Lots disponibles (FEFO)');
});

/** RAPPROCHEMENT — solde projeté vs journal des mouvements. */
exports.reconcile = asyncHandler(async (req, res) => {
  const productId = ensureObjectId(req.params.productId, 'Identifiant produit');
  const Balance = req.getModel('StockBalance', StockBalancesSchema);
  const Movement = req.getModel('StockMovement', StockMovementsSchema);

  const balances = await Balance.find(tenantFilter(req, { productId })).populate({
    path: 'lotId',
    select: 'lotNumber',
  });

  const rows = [];
  for (const b of balances) {
    const journal = await computeJournalBalance(Movement, b.pharmacyId, productId, b.lotId?._id || null);
    const projected = b.quantityOnHand;
    rows.push({
      lotId: b.lotId?._id || null,
      lotNumber: b.lotId?.lotNumber || null,
      projected,
      journal,
      difference: projected - journal,
      consistent: projected === journal,
    });
  }

  const globalDifference = rows.reduce((sum, r) => sum + r.difference, 0);
  return sendResponse(
    res,
    { productId, consistent: globalDifference === 0, globalDifference, rows },
    'Rapprochement du stock'
  );
});
