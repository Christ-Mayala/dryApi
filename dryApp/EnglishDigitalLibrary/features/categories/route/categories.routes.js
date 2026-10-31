const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const optionalAuth = require('../../../middlewares/optional-auth.middleware');
const controller = require('../controller/categories.controller');

const router = express.Router();
const manageCategories = [protect, authorize('admin', 'librarian')];
const administratorsOnly = [protect, authorize('admin')];

router.get('/', optionalAuth, asyncHandler(controller.list));
router.get('/admin', ...manageCategories, asyncHandler(controller.listForManagement));
router.post('/', ...manageCategories, withAudit('LIBRARY_CATEGORY_CREATE'), asyncHandler(controller.create));
router.patch('/:id', ...manageCategories, withAudit('LIBRARY_CATEGORY_UPDATE'), asyncHandler(controller.update));
router.delete('/:id', ...administratorsOnly, withAudit('LIBRARY_CATEGORY_DELETE'), asyncHandler(controller.remove));

module.exports = router;
