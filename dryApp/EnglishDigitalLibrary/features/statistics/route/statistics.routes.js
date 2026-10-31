const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const controller = require('../controller/statistics.controller');

const router = express.Router();
router.get('/home', asyncHandler(controller.home));
router.get('/admin', protect, authorize('admin'), asyncHandler(controller.admin));
module.exports = router;
