const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const controller = require('../controller/favorites.controller');

const router = express.Router();
router.get('/', protect, asyncHandler(controller.list));
router.put('/:bookId', protect, asyncHandler(controller.add));
router.delete('/:bookId', protect, asyncHandler(controller.remove));
module.exports = router;
