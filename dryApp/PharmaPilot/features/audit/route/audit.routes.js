const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const LogSchema = require('../../../../../dry/modules/log/log.schema');
const controller = require('../controller/audit.controller');

/**
 * Journal d'audit — consultation des actions sensibles.
 * Accessible aux roles manager+ (pharmacist et au-dessus).
 */
router.get(
  '/',
  protect,
  resolveTenant,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  queryBuilder((req) => req.getModel('Log', LogSchema), [{ path: 'user', select: 'name email' }]),
  controller.getAll
);

module.exports = router;
