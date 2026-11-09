const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant, applyTenantQuery } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../../../dry/utils/validation/validation.util');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const { validatePharmaPilot, ensureLabel } = require('../../../validation/middleware');
const ReceiptsSchema = require('../model/receipts.schema');
const controller = require('../controller/receipts.controller');

/**
 * Receptions fournisseur.
 *   GET    /            liste paginee
 *   POST   /            creation d'un brouillon
 *   GET    /:id         detail
 *   PUT    /:id         mise a jour d'un brouillon
 *   POST   /:id/validate validation transactionnelle (entrees + soldes)
 *   POST   /:id/cancel  annulation d'un brouillon
 */
const reads = [protect, resolveTenant, requirePermission(PERMISSIONS.RECEIPT_VIEW)];
const writes = [protect, resolveTenant, requirePermission(PERMISSIONS.RECEIPT_CREATE)];

router.get(
  '/',
  ...reads,
  applyTenantQuery,
  queryBuilder((req) => req.getModel('Receipt', ReceiptsSchema), [
    { path: 'supplierId', select: 'name phone email' },
  ]),
  controller.getAll
);

router.post(
  '/',
  ...writes,
  ensureLabel('receipts'),
  validatePharmaPilot.receipts.create,
  withAudit('RECEIPT_CREATE'),
  invalidateCache(),
  controller.create
);

router.get('/:id', ...reads, validateId, controller.getOne);

router.put(
  '/:id',
  ...writes,
  validateId,
  ensureLabel('receipts'),
  validatePharmaPilot.receipts.update,
  withAudit('RECEIPT_UPDATE'),
  invalidateCache(),
  controller.update
);

router.post(
  '/:id/validate',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.RECEIPT_VALIDATE),
  validateId,
  withAudit('RECEIPT_VALIDATE'),
  invalidateCache(),
  controller.validate
);

router.post(
  '/:id/cancel',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.RECEIPT_VALIDATE),
  validateId,
  withAudit('RECEIPT_CANCEL'),
  invalidateCache(),
  controller.cancel
);

module.exports = router;
