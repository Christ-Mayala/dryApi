const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant } = require('../../../lib/tenant');
const { requirePermission, PERMISSIONS } = require('../../../lib/permissions');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../../../dry/utils/validation/validation.util');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const { validatePharmaPilot, ensureLabel } = require('../../../validation/middleware');
const PharmaPilotUserSchema = require('../../auth/model/pharmaPilotUser.schema');
const controller = require('../controller/users.controller');

router.use(protect, resolveTenant);

router.get(
  '/',
  queryBuilder((req) => req.getModel('User', PharmaPilotUserSchema), null, { select: '-password' }),
  controller.getAll
);

router.post(
  '/',
  requirePermission(PERMISSIONS.USER_MANAGE),
  ensureLabel('users'),
  validatePharmaPilot.users.create,
  withAudit('CREATE_USER'),
  invalidateCache(),
  controller.create
);

router.get('/:id', validateId, controller.getOne);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validateId,
  ensureLabel('users'),
  validatePharmaPilot.users.update,
  withAudit('UPDATE_USER'),
  invalidateCache(),
  controller.update
);
router.delete('/:id', requirePermission(PERMISSIONS.USER_MANAGE), validateId, withAudit('DELETE_USER'), invalidateCache(), controller.remove);

module.exports = router;
