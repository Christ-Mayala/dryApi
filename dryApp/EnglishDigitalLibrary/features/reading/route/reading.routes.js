const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const controller = require('../controller/reading.controller');

const router = express.Router();
router.get('/', protect, asyncHandler(controller.list));
router.put('/:bookId', protect, asyncHandler(controller.save));
module.exports = router;
