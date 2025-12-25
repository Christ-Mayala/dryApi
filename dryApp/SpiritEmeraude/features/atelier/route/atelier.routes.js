const express = require('express');
const router = express.Router();
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const queryBuilder = require('../../../../../dry/middlewares/queryBuilder');
const AtelierSchema = require('../model/atelier.schema');

const create = require('../controller/atelier.create.controller');
const list = require('../controller/atelier.list.controller');
const get = require('../controller/atelier.get.controller');
const update = require('../controller/atelier.update.controller');
const remove = require('../controller/atelier.delete.controller');

const setupModel = (req, res, next) => {
    req.targetModel = req.getModel('Atelier', AtelierSchema);
    next();
};
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

router.get('/', setupModel, dynamicQB, list);
router.get('/:id', get);

router.post('/', protect, authorize('admin'), upload.fields([
    { name: 'images', maxCount: 50 },
    { name: 'videos', maxCount: 50 }
]), create);

router.put('/:id', protect, authorize('admin'), upload.fields([
    { name: 'images', maxCount: 50 },
    { name: 'videos', maxCount: 50 }
]), update);

router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
