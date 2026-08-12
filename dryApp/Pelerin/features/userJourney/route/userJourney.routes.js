const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validatePelerin, ensureLabel } = require('../../../validation/middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const UserJourneySchema = require('../model/userJourney.schema');

const getMy = require('../controller/userJourney.getMy.controller');
const upsertMy = require('../controller/userJourney.upsertMy.controller');
const adminList = require('../controller/userJourney.adminList.controller');

router.use(protect);

router.get('/me', getMy);
router.put('/me', withAudit('USERJOURNEY_UPSERT'), upsertMy);

router.get('/admin/all', protect, authorize('admin'), adminList);

module.exports = router;
