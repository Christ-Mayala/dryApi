const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReceiptsSchema = require('../model/receipts.schema');
const SuppliersSchema = require('../../suppliers/model/suppliers.schema');
const ProductsSchema = require('../../products/model/products.schema');
const { validateReceipt } = require('../service/receipts.service');
const { findExisting, remember } = require('../../../lib/idempotency');
const { badRequest, notFound } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

const models = (req) => ({
  Receipt: req.getModel('Receipt', ReceiptsSchema),
  Supplier: req.getModel('Supplier', SuppliersSchema),
  Product: req.getModel('Product', ProductsSchema),
});

const POPULATE = [
  { path: 'supplierId', select: 'name phone email' },
  { path: 'lines.productId', select: 'name sku unit form' },
  { path: 'lines.lotId', select: 'lotNumber expiryDate' },
];

/** Verifie que chaque produit appartient bien a la pharmacie courante. */
const validateProducts = async (req, lines) => {
  const { Product } = models(req);
  const ids = [...new Set(lines.map((l) => String(l.productId)))];
  const found = await Product.find(tenantFilter(req, { _id: { $in: ids } })).select('_id');
  const valid = new Set(found.map((p) => String(p._id)));
  lines.forEach((l) => {
    if (!valid.has(String(l.productId))) throw badRequest('Produit inexistant dans cette pharmacie');
  });
  return lines;
};

/** Normalise les lignes recues en lignes persistables. */
const sanitizeLines = (lines) =>
  lines.map((l) => ({
    productId: l.productId,
    lotId: l.lotId || null,
    lotNumber: String(l.lotNumber).trim(),
    expiryDate: l.expiryDate,
    quantityReceived: l.quantityReceived,
    quantityRejected: l.quantityRejected || 0,
    unitCost: l.unitCost ?? null,
  }));

const computeTotal = (lines) =>
  lines.reduce((sum, l) => sum + (l.unitCost ? l.unitCost * l.quantityReceived : 0), 0);

/** LISTE paginee des receptions. */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste des receptions', true, pagination || undefined);
});

/** DETAIL d'une reception. */
exports.getOne = asyncHandler(async (req, res) => {
  const { Receipt } = models(req);
  const doc = await Receipt.findOne(tenantFilter(req, { _id: req.params.id })).populate(POPULATE);
  if (!doc) throw notFound('Reception introuvable');
  return sendResponse(res, doc, 'Reception recuperee');
});

/** CREATE — reception en brouillon. */
exports.create = asyncHandler(async (req, res) => {
  const { Receipt, Supplier } = models(req);
  if (!req.pharmacyId) throw badRequest('Aucune pharmacie active pour creer une reception');

  const supplier = await Supplier.findOne(tenantFilter(req, { _id: req.body.supplierId }));
  if (!supplier) throw badRequest('Fournisseur inexistant dans cette pharmacie');

  const lines = sanitizeLines(await validateProducts(req, req.body.lines || []));

  const payload = {
    tenantId: req.tenantId,
    pharmacyId: req.pharmacyId,
    supplierId: req.body.supplierId,
    reference: req.body.reference || null,
    receivedAt: req.body.receivedAt || new Date(),
    note: req.body.note || null,
    status: 'draft',
    lines,
    totalAmount: computeTotal(lines),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  };

  const doc = await Receipt.create(payload);
  return sendResponse(res, doc, 'Reception creee (brouillon)', true, undefined, 201);
});

/** UPDATE — uniquement tant que la reception reste en brouillon. */
exports.update = asyncHandler(async (req, res) => {
  const { Receipt, Supplier } = models(req);
  const receipt = await Receipt.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!receipt) throw notFound('Reception introuvable');
  if (receipt.status !== 'draft') throw badRequest('Une reception non brouillon ne peut plus etre modifiee');

  if (req.body.supplierId) {
    const supplier = await Supplier.findOne(tenantFilter(req, { _id: req.body.supplierId }));
    if (!supplier) throw badRequest('Fournisseur inexistant dans cette pharmacie');
    receipt.supplierId = req.body.supplierId;
  }
  if (req.body.reference !== undefined) receipt.reference = req.body.reference;
  if (req.body.receivedAt !== undefined) receipt.receivedAt = req.body.receivedAt;
  if (req.body.note !== undefined) receipt.note = req.body.note;
  if (req.body.lines) {
    const lines = sanitizeLines(await validateProducts(req, req.body.lines));
    receipt.lines = lines;
    receipt.totalAmount = computeTotal(lines);
  }
  receipt.updatedBy = req.user._id;
  await receipt.save();
  return sendResponse(res, receipt, 'Reception mise a jour');
});

/** VALIDATE — operation critique, transactionnelle et idempotente. */
exports.validate = asyncHandler(async (req, res) => {
  const { Receipt } = models(req);

  const existing = await findExisting(req);
  if (existing?.responseRef) {
    return sendResponse(res, existing.responseRef, 'Reception deja validee');
  }

  const receipt = await validateReceipt(req);
  const data = await Receipt.findById(receipt._id).populate(POPULATE);
  await remember(req, data);
  return sendResponse(res, data, 'Reception validee : entrees enregistrees');
});

/** CANCEL — annulation d'un brouillon (aucun mouvement n'a encore ete cree). */
exports.cancel = asyncHandler(async (req, res) => {
  const { Receipt } = models(req);
  const receipt = await Receipt.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!receipt) throw notFound('Reception introuvable');
  if (receipt.status === 'validated') {
    throw badRequest('Une reception validee ne peut pas etre annulee : creez un contre-mouvement');
  }
  if (receipt.status === 'cancelled') return sendResponse(res, receipt, 'Reception deja annulee');

  receipt.status = 'cancelled';
  receipt.updatedBy = req.user._id;
  await receipt.save();
  return sendResponse(res, receipt, 'Reception annulee');
});
