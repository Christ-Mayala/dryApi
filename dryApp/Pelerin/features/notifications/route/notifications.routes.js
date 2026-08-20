const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const registerToken = require('../controller/notifications.registerToken.controller');
const getPreferences = require('../controller/notifications.getPreferences.controller');
const updatePreferences = require('../controller/notifications.updatePreferences.controller');
const getMine = require('../controller/notifications.getMine.controller');
const markRead = require('../controller/notifications.markRead.controller');
const markAllRead = require('../controller/notifications.markAllRead.controller');

router.use(protect);

router.post('/register', withAudit('NOTIFICATION_REGISTER'), registerToken);
router.get('/preferences', getPreferences);
router.put('/preferences', withAudit('NOTIFICATION_PREFS_UPDATE'), updatePreferences);

// ── Inbox (notifications reçues) ────────────────────────────────────────
router.get('/', getMine);
router.post('/read-all', withAudit('NOTIFICATION_READ_ALL'), markAllRead);
router.post('/:id/read', withAudit('NOTIFICATION_READ'), markRead);

module.exports = router;
