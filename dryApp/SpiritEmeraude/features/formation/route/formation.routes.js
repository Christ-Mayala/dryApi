const express = require('express');
const router = express.Router();
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const queryBuilder = require('../../../../../dry/middlewares/queryBuilder');
const FormationSchema = require('../model/formation.schema');

// CORRECTION DES IMPORTS (Ajout de .controller)
const create = require('../controller/formation.create.controller');
const list = require('../controller/formation.list.controller');
const get = require('../controller/formation.get.controller');
const update = require('../controller/formation.update.controller');
const remove = require('../controller/formation.delete.controller');

const setupModel = (req, res, next) => {
    req.targetModel = req.getModel('Formation', FormationSchema);
    next();
};
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// Routes
router.get('/', setupModel, dynamicQB, list);
router.get('/:id', get);

router.post('/', protect, authorize('admin'), upload.single('image'), create);
router.put('/:id', protect, authorize('admin'), upload.single('image'), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;