const express = require('express');
const router = express.Router();

const upload = require('../../../services/upload.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/podcastEpisode.create.controller');
const getAll = require('../controller/podcastEpisode.getAll.controller');
const getAllAdmin = require('../controller/podcastEpisode.getAllAdmin.controller');
const getById = require('../controller/podcastEpisode.getById.controller');
const update = require('../controller/podcastEpisode.update.controller');
const remove = require('../controller/podcastEpisode.delete.controller');
const progress = require('../controller/podcastEpisode.progress.controller');
const history = require('../controller/podcastEpisode.history.controller');
const favorites = require('../controller/podcastEpisode.favorites.controller');

const episodeUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

// ── Routes spécifiques (AVANT /:id) ─────────────────────────────────────
router.get('/admin/all', protect, authorize('admin'), getAllAdmin);

// Données personnelles (historique, favoris, progression) — authentifiées.
router.get('/history', protect, history);
router.get('/favorites', protect, favorites.listMine);
router.post('/favorites/:id', protect, validateId, favorites.add);
router.delete('/favorites/:id', protect, validateId, favorites.remove);
router.get('/progress/:id', protect, validateId, progress.getOne);
router.put('/progress/:id', protect, validateId, progress.upsert);

// ── Routes publiques / CRUD ─────────────────────────────────────────────
router.get('/', cache(300), getAll);
router.get('/:id', validateId, cache(600), getById);

router.post('/', protect, authorize('admin'), episodeUpload, withAudit('PODCASTEPISODE_CREATE'), invalidateCache(), create);
router.put('/:id', protect, authorize('admin'), validateId, episodeUpload, withAudit('PODCASTEPISODE_UPDATE'), invalidateCache(), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('PODCASTEPISODE_DELETE'), invalidateCache(), remove);

module.exports = router;
