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
const AlertsSchema = require('../model/alerts.schema');
const controller = require('../controller/alerts.controller');

/**
 * Alertes de stock et de peremption.
 *   GET   /          liste paginee
 *   POST  /refresh   recalcul a partir des donnees reelles
 *   GET   /:id       detail
 *   PATCH /:id       prise en charge (statut / note)
 */
const reads = [protect, resolveTenant, requirePermission(PERMISSIONS.ALERT_VIEW)];

router.get(
  '/',
  ...reads,
  applyTenantQuery,
  queryBuilder((req) => req.getModel('Alert', AlertsSchema), [
    { path: 'productId', select: 'name sku unit form' },
    { path: 'lotId', select: 'lotNumber expiryDate' },
  ]),
  controller.getAll
);

router.post(
  '/refresh',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.ALERT_MANAGE),
  withAudit('ALERTS_REFRESH'),
  invalidateCache(),
  controller.refresh
);

router.get('/:id', ...reads, validateId, controller.getOne);

router.patch(
  '/:id',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.ALERT_MANAGE),
  validateId,
  validatePharmaPilot.alerts.update,
  withAudit('ALERT_UPDATE'),
  invalidateCache(),
  controller.update
);

module.exports = router;
