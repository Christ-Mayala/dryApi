const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validatePelerin } = require('../../../validation/middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const getMy = require('../controller/spiritualProfile.getMy.controller');
const upsertMy = require('../controller/spiritualProfile.upsertMy.controller');

router.use(protect);

// Canonical /me routes
router.get('/me', getMy);
router.put('/me', withAudit('SPIRITUALPROFILE_UPSERT'), validatePelerin.spiritualProfile.upsert, upsertMy);

// Root aliases — the mobile client currently calls GET/PUT without /me
router.get('/', getMy);
router.put('/', withAudit('SPIRITUALPROFILE_UPSERT'), validatePelerin.spiritualProfile.upsert, upsertMy);

module.exports = router;
