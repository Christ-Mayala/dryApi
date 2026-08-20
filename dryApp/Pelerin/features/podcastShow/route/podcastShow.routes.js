const express = require('express');
const rateLimit = require('express-rate-limit');
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
const importPreview = require('../controller/podcastShow.importPreview.controller');
const importShow = require('../controller/podcastShow.import.controller');
const syncShow = require('../controller/podcastShow.sync.controller');
const discover = require('../controller/podcastShow.discover.controller');
const subscriptions = require('../controller/podcastShow.subscriptions.controller');
const moderate = require('../controller/podcastShow.moderate.controller');
const approvePending = require('../controller/podcastShow.approvePending.controller');
const pipeline = require('../controller/podcastShow.pipeline.controller');
const config = require('../controller/podcastShow.config.controller');
const configScoring = require('../controller/podcastShow.configScoring.controller');
const configTest = require('../controller/podcastShow.configTest.controller');
const discoverRun = require('../controller/podcastShow.discoverRun.controller');

const coverUpload = upload.fields([{ name: 'cover', maxCount: 1 }]);

// Limitation stricte de la découverte Podcast Index (API tierce) : 20
// recherches / minute / IP. Les credentials restent côté serveur.
const discoverLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de recherches — patiente une minute.' },
});

// ── Routes spécifiques (AVANT /:id) ─────────────────────────────────────
router.get('/admin/all', protect, authorize('admin'), getAllAdmin);
router.get('/admin/pipeline', protect, authorize('admin'), pipeline);
router.get('/admin/config', protect, authorize('admin'), config);
router.put('/admin/config/scoring', protect, authorize('admin'), withAudit('PODCAST_CONFIG_UPDATE'), invalidateCache(), configScoring);
router.post('/admin/config/test', protect, authorize('admin'), withAudit('PODCAST_CONFIG_TEST'), configTest);
router.post('/admin/discover/run', protect, authorize('admin'), discoverLimiter, withAudit('PODCAST_DISCOVER_RUN'), discoverRun);
router.post('/admin/approve-pending', protect, authorize('admin'), withAudit('PODCAST_APPROVE_PENDING'), invalidateCache(), approvePending);
router.get('/discover', protect, authorize('admin'), discoverLimiter, withAudit('PODCAST_DISCOVER'), discover);

router.post('/import/preview', protect, authorize('admin'), withAudit('PODCAST_IMPORT_PREVIEW'), importPreview);
router.post('/import', protect, authorize('admin'), withAudit('PODCAST_IMPORT'), invalidateCache(), importShow);
router.post('/:id/sync', protect, authorize('admin'), validateId, withAudit('PODCAST_SYNC'), invalidateCache(), syncShow);
router.post('/:id/moderate', protect, authorize('admin'), validateId, withAudit('PODCAST_MODERATE'), invalidateCache(), moderate);

// Abonnements ("Suivre") — données personnelles, authentifiées.
router.get('/subscriptions', protect, subscriptions.listMine);
router.post('/subscriptions/:id', protect, validateId, subscriptions.follow);
router.delete('/subscriptions/:id', protect, validateId, subscriptions.unfollow);

// ── Routes publiques / CRUD ─────────────────────────────────────────────
router.get('/', cache(300), getAll);
router.get('/:id', validateId, cache(600), getById);

router.post('/', protect, authorize('admin'), coverUpload, withAudit('PODCASTSHOW_CREATE'), invalidateCache(), create);
router.put('/:id', protect, authorize('admin'), validateId, coverUpload, withAudit('PODCASTSHOW_UPDATE'), invalidateCache(), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('PODCASTSHOW_DELETE'), invalidateCache(), remove);

module.exports = router;
