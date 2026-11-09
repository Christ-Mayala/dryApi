const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../../../dry/utils/validation/validation.util');
const { validatePharmaPilot, ensureLabel } = require('../../../validation/middleware');
const controller = require('../controller/organizations.controller');

router.use(protect, resolveTenant);

const manage = requirePermission(PERMISSIONS.ORGANIZATION_MANAGE);

router.get('/', controller.getAll);
router.post(
  '/',
  manage,
  ensureLabel('organizations'),
  validatePharmaPilot.organizations.create,
  withAudit('CREATE_ORGANIZATION'),
  invalidateCache(),
  controller.create
);

router.get('/:id', validateId, controller.getOne);
router.put(
  '/:id',
  manage,
  validateId,
  ensureLabel('organizations'),
  validatePharmaPilot.organizations.update,
  withAudit('UPDATE_ORGANIZATION'),
  invalidateCache(),
  controller.update
);
router.delete('/:id', manage, validateId, withAudit('DELETE_ORGANIZATION'), invalidateCache(), controller.remove);

module.exports = router;
