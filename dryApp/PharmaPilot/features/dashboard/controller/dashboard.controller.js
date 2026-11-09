const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const StockMovementsSchema = require('../../movements/model/stockMovements.schema');
const ProductsSchema = require('../../products/model/products.schema');
const CategoriesSchema = require('../../categories/model/categories.schema');
const SuppliersSchema = require('../../suppliers/model/suppliers.schema');
const LotsSchema = require('../../lots/model/lots.schema');
const ReceiptsSchema = require('../../receipts/model/receipts.schema');
const AlertsSchema = require('../../alerts/model/alerts.schema');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const { tenantFilter } = require('../../../lib/tenant');

const DAY_MS = 24 * 60 * 60 * 1000;
const notDeleted = { status: { $ne: 'deleted' } };

/**
 * Tableau de bord operationnel.
 * Tous les indicateurs proviennent de donnees verifiables (soldes, lots,
 * mouvements, receptions, alertes) — aucun chiffre decore ou simule.
 */
exports.getStats = asyncHandler(async (req, res) => {
  const Balance = req.getModel('StockBalance', StockBalancesSchema);
  const Movement = req.getModel('StockMovement', StockMovementsSchema);
  const Product = req.getModel('Product', ProductsSchema);
  const Category = req.getModel('Category', CategoriesSchema);
  const Supplier = req.getModel('Supplier', SuppliersSchema);
  const Lot = req.getModel('Lot', LotsSchema);
  const Receipt = req.getModel('Receipt', ReceiptsSchema);
  const Alert = req.getModel('Alert', AlertsSchema);
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);

  const pharmacy = req.pharmacyId ? await Pharmacy.findById(req.pharmacyId) : null;
  const lowStockThreshold = pharmacy?.settings?.lowStockThreshold ?? 10;
  const expiryAlertDays = pharmacy?.settings?.expiryAlertDays ?? 90;
  const currency = pharmacy?.settings?.currency ?? 'XAF';

  const [productsCount, categoriesCount, suppliersCount, receiptsDraft, receiptsValidated, movementsCount] =
    await Promise.all([
      Product.countDocuments(tenantFilter(req, notDeleted)),
      Category.countDocuments(tenantFilter(req, notDeleted)),
      Supplier.countDocuments(tenantFilter(req, notDeleted)),
      Receipt.countDocuments(tenantFilter(req, { status: 'draft' })),
      Receipt.countDocuments(tenantFilter(req, { status: 'validated' })),
      Movement.countDocuments(tenantFilter(req, notDeleted)),
    ]);

  const balances = await Balance.find(tenantFilter(req, notDeleted));

  const productIds = [...new Set(balances.map((b) => String(b.productId)))];
  const products = await Product.find({ _id: { $in: productIds.length ? productIds : [null] } }).select(
    'name sku price reorderThreshold'
  );
  const productById = new Map(products.map((p) => [String(p._id), p]));

  let stockTotalQuantity = 0;
  let stockValue = 0;
  const perProduct = new Map();

  for (const b of balances) {
    const qty = b.quantityOnHand || 0;
    stockTotalQuantity += qty;
    const product = productById.get(String(b.productId));
    if (product?.price) stockValue += product.price * qty;
    perProduct.set(String(b.productId), (perProduct.get(String(b.productId)) || 0) + qty);
  }

  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const [pid, qty] of perProduct.entries()) {
    const product = productById.get(pid);
    const threshold = product?.reorderThreshold ?? lowStockThreshold;
    if (qty <= 0) outOfStockCount += 1;
    else if (qty <= threshold) lowStockCount += 1;
  }

  // Peremptions : seuls les lots encore en stock sont consideres.
  const lotIds = [
    ...new Set(balances.filter((b) => b.lotId && (b.quantityOnHand || 0) > 0).map((b) => String(b.lotId))),
  ];
  const lots = await Lot.find({ _id: { $in: lotIds.length ? lotIds : [null] } }).select('lotNumber expiryDate');
  const now = Date.now();
  const expiryLimit = now + expiryAlertDays * DAY_MS;
  let expiringLotsCount = 0;
  let expiredLotsCount = 0;
  for (const lot of lots) {
    const t = lot.expiryDate ? lot.expiryDate.getTime() : null;
    if (!t) continue;
    if (t < now) expiredLotsCount += 1;
    else if (t <= expiryLimit) expiringLotsCount += 1;
  }

  const openAlerts = await Alert.find(tenantFilter(req, { status: { $in: ['open', 'acknowledged'] } })).select(
    'type severity status message'
  );
  const alertsBySeverity = { info: 0, warning: 0, critical: 0 };
  openAlerts.forEach((a) => {
    if (alertsBySeverity[a.severity] !== undefined) alertsBySeverity[a.severity] += 1;
  });

  const recentMovements = await Movement.find(tenantFilter(req, notDeleted))
    .sort('-occurredAt')
    .limit(10)
    .populate({ path: 'productId', select: 'name sku unit' })
    .populate({ path: 'lotId', select: 'lotNumber' })
    .populate({ path: 'actorId', select: 'name' });

  const recentReceipts = await Receipt.find(tenantFilter(req, {}))
    .sort('-createdAt')
    .limit(5)
    .populate({ path: 'supplierId', select: 'name' });

  return sendResponse(
    res,
    {
      pharmacy: pharmacy
        ? { id: pharmacy._id, name: pharmacy.name, currency }
        : null,
      counts: {
        products: productsCount,
        categories: categoriesCount,
        suppliers: suppliersCount,
        movements: movementsCount,
      },
      stock: {
        totalQuantity: stockTotalQuantity,
        value: stockValue,
        currency,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        lowStockThreshold,
      },
      lots: {
        expiring: expiringLotsCount,
        expired: expiredLotsCount,
        expiryAlertDays,
      },
      receipts: {
        draft: receiptsDraft,
        validated: receiptsValidated,
      },
      alerts: {
        open: openAlerts.length,
        bySeverity: alertsBySeverity,
      },
      recentMovements,
      recentReceipts,
    },
    'Indicateurs du tableau de bord'
  );
});
