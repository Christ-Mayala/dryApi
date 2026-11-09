const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const controller = require('../controller/dashboard.controller');

/** Tableau de bord operationnel (lecture seule). */
router.get('/', protect, resolveTenant, requirePermission(PERMISSIONS.DASHBOARD_VIEW), controller.getStats);

module.exports = router;
