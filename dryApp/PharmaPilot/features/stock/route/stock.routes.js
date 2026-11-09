const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const controller = require('../controller/stock.controller');

/**
 * Consultation du stock (lecture seule, aucune ecriture directe possible).
 *   GET /                          vue globale par produit
 *   GET /reconcile/:productId      rapprochement solde / journal
 *   GET /:productId/lots           lots disponibles (FEFO)
 *   GET /:productId                stock detaille par produit
 */
const reads = [protect, resolveTenant, requirePermission(PERMISSIONS.STOCK_VIEW)];

router.get('/', ...reads, controller.getOverview);
router.get('/reconcile/:productId', protect, resolveTenant, requirePermission(PERMISSIONS.STOCK_RECONCILE), controller.reconcile);
router.get('/:productId/lots', ...reads, controller.getProductLots);
router.get('/:productId', ...reads, controller.getProductStock);

module.exports = router;
