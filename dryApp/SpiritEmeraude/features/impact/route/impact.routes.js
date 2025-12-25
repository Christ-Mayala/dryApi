const express = require('express');
const router = express.Router();
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

// CORRECTION DES IMPORTS (Ajout de .controller)
const create = require('../controller/impact.create.controller');
const list = require('../controller/impact.list.controller');
const update = require('../controller/impact.update.controller'); // Si tu l'as créé
const remove = require('../controller/impact.delete.controller');

router.get('/', list);
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