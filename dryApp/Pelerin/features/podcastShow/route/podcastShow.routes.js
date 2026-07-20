const express = require('express');
const router = express.Router();

const upload = require('../../../services/upload.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/podcastShow.create.controller');
const getAll = require('../controller/podcastShow.getAll.controller');
const getAllAdmin = require('../controller/podcastShow.getAllAdmin.controller');
const getById = require('../controller/podcastShow.getById.controller');
const update = require('../controller/podcastShow.update.controller');
const remove = require('../controller/podcastShow.delete.controller');

const coverUpload = upload.fields([{ name: 'cover', maxCount: 1 }]);

// Route specifique AVANT /:id.
router.get('/admin/all', protect, authorize('admin'), getAllAdmin);

router.get('/', cache(300), getAll);
router.get('/:id', validateId, cache(600), getById);

router.post('/', protect, authorize('admin'), coverUpload, withAudit('PODCASTSHOW_CREATE'), invalidateCache(), create);
router.put('/:id', protect, authorize('admin'), validateId, coverUpload, withAudit('PODCASTSHOW_UPDATE'), invalidateCache(), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('PODCASTSHOW_DELETE'), invalidateCache(), remove);

module.exports = router;
