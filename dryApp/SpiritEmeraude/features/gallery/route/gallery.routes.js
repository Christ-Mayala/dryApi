const express = require('express');
const router = express.Router();
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

const create = require('../controller/gallery.create.controller');
const list = require('../controller/gallery.list.controller');
const update = require('../controller/gallery.update.controller');
const remove = require('../controller/gallery.delete.controller');

router.get('/', list);
router.post('/', protect, authorize('admin'), upload.array('images', 50), create);
router.put('/:id', protect, authorize('admin'), upload.single('image'), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
