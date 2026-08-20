const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const sendResponse = require('../../../../../dry/utils/http/response');

const controller = require('../controller/housePreaching.controller');
const adminController = require('../controller/housePreaching.admin.controller');
const sourceController = require('../controller/housePreachingSource.admin.controller');

// ── Sources YouTube (admin) ───────────────────────────────────────────────
router.get('/sources', protect, authorize('admin'), sourceController.listSources);
router.post('/sources', protect, authorize('admin'), withAudit('HOUSE_PREACHING_SOURCE_CREATE'), invalidateCache(), sourceController.createSource);
router.post('/sources/add', protect, authorize('admin'), withAudit('HOUSE_PREACHING_SOURCE_ADD_CHANNEL'), invalidateCache(), sourceController.addChannel);
router.post('/sources/:id/resolve', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_SOURCE_RESOLVE'), invalidateCache(), sourceController.resolveSource);
router.put('/sources/:id', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_SOURCE_UPDATE'), invalidateCache(), sourceController.updateSource);
router.delete('/sources/:id', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_SOURCE_DELETE'), invalidateCache(), sourceController.removeSource);
router.post('/sources/:id/toggle', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_SOURCE_TOGGLE'), invalidateCache(), sourceController.toggleActive);

// ── Sync globale ──────────────────────────────────────────────────────────
// Passe par le MÊME point d'entrée que le cron (housePreachingSync.scheduler) :
// runHousePreachingSyncNow() réutilise syncFromYouTube et son flag
// anti-concurrence `running` — une sync manuelle ne s'exécute jamais en
// parallèle d'une passe automatique (et inversement).
router.post('/sync-all', protect, authorize('admin'), withAudit('HOUSE_PREACHING_SYNC_ALL'), async (req, res) => {
  const { runHousePreachingSyncNow } = require('../../../services/housePreachingSync.scheduler');
  const result = await runHousePreachingSyncNow();
  return sendResponse(res, result, 'Synchronisation terminée');
});

// ── Routes spécifiques (AVANT /:id) ─────────────────────────────────────
router.get('/continue', protect, controller.getContinue);
router.get('/preachers', require('../../../../../dry/middlewares/cache/cache.middleware').cache(300), controller.getPreachers);

// Suivis de prêcheurs (personnel, synchronisé entre appareils)
router.get('/follows', protect, controller.getFollows);
router.put('/follows', protect, controller.setFollows);
router.post('/follows', protect, controller.addFollow);
router.delete('/follows/:preacher', protect, controller.removeFollow);

router.post('/:id/progress', protect, validateId, controller.saveProgress);

// Page HTML du lecteur YouTube servie par le backend (origine réelle → lecture
// fiable dans la WebView mobile). Publique : la WebView ne porte pas de token.
router.get('/embed/youtube/:videoId', controller.getEmbedPage);

// Admin prédications
router.get('/admin/all', protect, authorize('admin'), adminController.listAll);
router.post('/admin', protect, authorize('admin'), withAudit('HOUSE_PREACHING_CREATE'), invalidateCache(), adminController.create);
router.put('/admin/:id', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_UPDATE'), invalidateCache(), adminController.update);
router.delete('/admin/:id', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_DELETE'), invalidateCache(), adminController.remove);
router.post('/admin/:id/publish', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_PUBLISH'), invalidateCache(), adminController.togglePublish);
router.post('/admin/:id/activate', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_ACTIVATE'), invalidateCache(), adminController.toggleActive);
router.post('/admin/:id/sync', protect, authorize('admin'), validateId, withAudit('HOUSE_PREACHING_SYNC'), invalidateCache(), adminController.syncYouTube);

// Publique
router.get('/', require('../../../../../dry/middlewares/cache/cache.middleware').cache(300), controller.getAll);
router.get('/:id', validateId, require('../../../../../dry/middlewares/cache/cache.middleware').cache(600), controller.getById);

module.exports = router;
