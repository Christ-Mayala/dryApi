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
const InventoriesSchema = require('../model/inventories.schema');
const controller = require('../controller/inventories.controller');

/**
 * Inventaires.
 *   GET  /              liste paginee
 *   POST /              ouverture d'une session (theorique fige)
 *   GET  /:id           detail
 *   PUT  /:id/lines     saisie des comptages
 *   POST /:id/validate  validation (ajustements traces)
 *   POST /:id/cancel    abandon
 */
const reads = [protect, resolveTenant, requirePermission(PERMISSIONS.INVENTORY_VIEW)];
const writes = [protect, resolveTenant, requirePermission(PERMISSIONS.INVENTORY_CREATE)];

router.get(
  '/',
  ...reads,
  applyTenantQuery,
  queryBuilder((req) => req.getModel('Inventory', InventoriesSchema), [{ path: 'categoryId', select: 'name' }]),
  controller.getAll
);

router.post(
  '/',
  ...writes,
  validatePharmaPilot.inventories.create,
  withAudit('INVENTORY_CREATE'),
  invalidateCache(),
  controller.create
);

router.get('/:id', ...reads, validateId, controller.getOne);

router.put(
  '/:id/lines',
  ...writes,
  validateId,
  validatePharmaPilot.inventories.updateLines,
  withAudit('INVENTORY_LINES_UPDATE'),
  invalidateCache(),
  controller.updateLines
);

router.post(
  '/:id/validate',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.INVENTORY_VALIDATE),
  validateId,
  withAudit('INVENTORY_VALIDATE'),
  invalidateCache(),
  controller.validate
);

router.post(
  '/:id/cancel',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.INVENTORY_VALIDATE),
  validateId,
  withAudit('INVENTORY_CANCEL'),
  invalidateCache(),
  controller.cancel
);

module.exports = router;
