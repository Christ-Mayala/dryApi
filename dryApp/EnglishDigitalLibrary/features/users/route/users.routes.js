const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const controller = require('../controller/users.controller');

const router = express.Router();
const administratorOnly = [protect, authorize('admin')];
router.get('/', ...administratorOnly, asyncHandler(controller.list));
router.patch('/:id/role', ...administratorOnly, withAudit('LIBRARY_USER_ROLE_UPDATE'), asyncHandler(controller.updateRole));
module.exports = router;
