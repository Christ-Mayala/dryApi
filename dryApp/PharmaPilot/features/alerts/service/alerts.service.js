const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const ProductsSchema = require('../../products/model/products.schema');
const LotsSchema = require('../../lots/model/lots.schema');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const AlertsSchema = require('../model/alerts.schema');
const { badRequest } = require('../../../lib/errors');

const DAY_MS = 24 * 60 * 60 * 1000;

const keyOf = (a) => `${a.type}:${String(a.productId)}:${a.lotId ? String(a.lotId) : ''}`;

/**
 * Moteur d'alertes : recalcule l'etat d'alerte d'une pharmacie a partir des
 * soldes et des lots, puis synchronise la collection `alerts`.
 *
 * - une condition toujours vraie met a jour l'alerte existante ;
 * - une nouvelle condition cree l'alerte ;
 * - une condition disparue resout automatiquement l'alerte ouverte.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{created:number, updated:number, resolved:number, open:number}>}
 */
const refreshAlerts = async (req) => {
  const Balance = req.getModel('StockBalance', StockBalancesSchema);
  const Product = req.getModel('Product', ProductsSchema);
  const Lot = req.getModel('Lot', LotsSchema);
  const Alert = req.getModel('Alert', AlertsSchema);
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);

  if (!req.pharmacyId) throw badRequest('Aucune pharmacie active pour recalculer les alertes');

  const pharmacy = await Pharmacy.findById(req.pharmacyId);
  const lowStockThreshold = pharmacy?.settings?.lowStockThreshold ?? 10;
  const expiryAlertDays = pharmacy?.settings?.expiryAlertDays ?? 90;
  const now = new Date();
  const expiryLimit = new Date(now.getTime() + expiryAlertDays * DAY_MS);

  const balances = await Balance.find({ pharmacyId: req.pharmacyId });

  // 1. Agregation du stock par produit (rupture / stock faible).
  const perProduct = new Map();
  for (const b of balances) {
    const pid = String(b.productId);
    perProduct.set(pid, (perProduct.get(pid) || 0) + (b.quantityOnHand || 0));
  }

  const products = await Product.find({
    pharmacyId: req.pharmacyId,
    _id: { $in: [...perProduct.keys()] },
  }).select('name sku reorderThreshold');

  const desired = [];

  for (const p of products) {
    const qty = perProduct.get(String(p._id)) || 0;
    const threshold = p.reorderThreshold ?? lowStockThreshold;
    if (qty <= 0) {
      desired.push({
        type: 'out_of_stock',
        productId: p._id,
        lotId: null,
        severity: 'critical',
        value: qty,
        threshold,
        message: `Rupture de stock : ${p.name}`,
      });
    } else if (qty <= threshold) {
      desired.push({
        type: 'low_stock',
        productId: p._id,
        lotId: null,
        severity: 'warning',
        value: qty,
        threshold,
        message: `Stock faible : ${p.name} (${qty} <= seuil ${threshold})`,
      });
    }
  }

  // 2. Alertes de peremption par lot.
  const lotIds = [...new Set(balances.filter((b) => b.lotId && (b.quantityOnHand || 0) > 0).map((b) => String(b.lotId)))];
  if (lotIds.length) {
    const lots = await Lot.find({ _id: { $in: lotIds } }).select('lotNumber expiryDate productId');
    const lotById = new Map(lots.map((l) => [String(l._id), l]));

    for (const b of balances) {
      if (!b.lotId || (b.quantityOnHand || 0) <= 0) continue;
      const lot = lotById.get(String(b.lotId));
      if (!lot || !lot.expiryDate) continue;

      if (lot.expiryDate.getTime() < now.getTime()) {
        desired.push({
          type: 'expired',
          productId: lot.productId,
          lotId: lot._id,
          severity: 'critical',
          value: b.quantityOnHand,
          expiryDate: lot.expiryDate,
          message: `Lot perime : ${lot.lotNumber}`,
        });
      } else if (lot.expiryDate.getTime() <= expiryLimit.getTime()) {
        desired.push({
          type: 'expiring',
          productId: lot.productId,
          lotId: lot._id,
          severity: 'warning',
          value: b.quantityOnHand,
          expiryDate: lot.expiryDate,
          message: `Peremption proche : ${lot.lotNumber}`,
        });
      }
    }
  }

  // 3. Synchronisation avec les alertes ouvertes.
  const openAlerts = await Alert.find({ pharmacyId: req.pharmacyId, status: { $in: ['open', 'acknowledged'] } });
  const openByKey = new Map(openAlerts.map((a) => [keyOf(a), a]));
  const desiredKeys = new Set(desired.map(keyOf));

  let created = 0;
  let updated = 0;
  let resolved = 0;

  for (const d of desired) {
    const existing = openByKey.get(keyOf(d));
    if (existing) {
      existing.value = d.value;
      existing.severity = d.severity;
      existing.message = d.message;
      existing.threshold = d.threshold ?? existing.threshold;
      existing.expiryDate = d.expiryDate ?? existing.expiryDate;
      await existing.save();
      updated += 1;
    } else {
      await Alert.create({
        tenantId: req.tenantId,
        pharmacyId: req.pharmacyId,
        label: d.message,
        ...d,
        status: 'open',
        createdBy: req.user?._id,
        updatedBy: req.user?._id,
      });
      created += 1;
    }
  }

  for (const a of openAlerts) {
    if (!desiredKeys.has(keyOf(a))) {
      a.status = 'resolved';
      a.resolvedAt = new Date();
      a.resolvedBy = req.user?._id;
      await a.save();
      resolved += 1;
    }
  }

  return { created, updated, resolved, open: desired.length };
};

module.exports = { refreshAlerts };
