const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant, applyTenantQuery } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../../../dry/utils/validation/validation.util');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const { validatePharmaPilot } = require('../../../validation/middleware');
const StockMovementsSchema = require('../model/stockMovements.schema');
const controller = require('../controller/movements.controller');

/**
 * Journal des mouvements de stock.
 * Les mouvements sont immuables : aucune route PUT/DELETE n'est exposee.
 */
const reads = [protect, resolveTenant, requirePermission(PERMISSIONS.MOVEMENT_VIEW)];

router.get(
  '/',
  ...reads,
  applyTenantQuery,
  queryBuilder((req) => req.getModel('StockMovement', StockMovementsSchema), [
    { path: 'productId', select: 'name sku unit form' },
    { path: 'lotId', select: 'lotNumber expiryDate' },
    { path: 'actorId', select: 'name email' },
  ]),
  controller.getAll
);

router.post(
  '/',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.MOVEMENT_CREATE),
  validatePharmaPilot.movements.create,
  withAudit('MOVEMENT_CREATE'),
  invalidateCache(),
  controller.create
);

router.get('/:id', ...reads, validateId, controller.getOne);

module.exports = router;
