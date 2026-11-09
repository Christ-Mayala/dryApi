const express = require('express');
const router = express.Router();
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { resolveTenant, requireRole } = require('../../../lib/tenant');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../../../dry/utils/validation/validation.util');
const { validatePharmaPilot, ensureLabel } = require('../../../validation/middleware');
const controller = require('../controller/pharmacies.controller');

router.use(protect, resolveTenant);

router.get('/', controller.getAll);
router.post('/', requireRole('saas_admin'), ensureLabel('pharmacies'), validatePharmaPilot.pharmacies.create, withAudit('CREATE_PHARMACY'), invalidateCache(), controller.create);

router.get('/:id', validateId, controller.getOne);
router.put('/:id', validateId, ensureLabel('pharmacies'), validatePharmaPilot.pharmacies.update, withAudit('UPDATE_PHARMACY'), invalidateCache(), controller.update);
router.delete('/:id', requireRole('saas_admin'), validateId, withAudit('DELETE_PHARMACY'), invalidateCache(), controller.remove);

module.exports = router;
