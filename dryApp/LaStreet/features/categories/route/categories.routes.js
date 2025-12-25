const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

const listCategories = require('../controller/categories.list.controller');
const createCategory = require('../controller/categories.create.controller');
const updateCategory = require('../controller/categories.update.controller');
const deleteCategory = require('../controller/categories.delete.controller');

const createTrade = require('../controller/trades.create.controller');
const updateTrade = require('../controller/trades.update.controller');
const deleteTrade = require('../controller/trades.delete.controller');

router.get('/', listCategories);

router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

router.post('/trades', protect, authorize('admin'), createTrade);
router.put('/trades/:id', protect, authorize('admin'), updateTrade);
router.delete('/trades/:id', protect, authorize('admin'), deleteTrade);

module.exports = router;
