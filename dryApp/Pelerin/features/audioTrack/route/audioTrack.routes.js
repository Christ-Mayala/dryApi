const express = require('express');
const router = express.Router();

const upload = require('../../../services/upload.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/audioTrack.create.controller');
const getAll = require('../controller/audioTrack.getAll.controller');
const getById = require('../controller/audioTrack.getById.controller');
const update = require('../controller/audioTrack.update.controller');
const remove = require('../controller/audioTrack.delete.controller');

// Controleurs custom (pas buildCrudRouter) : ce feature accepte soit un
// fichier uploade (multipart, champs "audio"/"cover"), soit un lien externe
// dans le body JSON — le multer generique de buildCrudRouter ne gere pas ce
// choix a la volee.
const trackUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

router.get('/', cache(300), getAll);
router.get('/:id', validateId, cache(600), getById);

router.post('/', protect, authorize('admin'), trackUpload, withAudit('AUDIOTRACK_CREATE'), invalidateCache(), create);
router.put('/:id', protect, authorize('admin'), validateId, trackUpload, withAudit('AUDIOTRACK_UPDATE'), invalidateCache(), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('AUDIOTRACK_DELETE'), invalidateCache(), remove);

module.exports = router;
