const express = require('express');
const router = express.Router();

const { getProfile, upsertProfile } = require('../controller/intel.controller');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

// GET  /api/v1/trivida/intel/profile → récupère l'IntelProfile
router.get('/profile', protect, withAudit('TRIVIDA_INTEL_GET_PROFILE'), getProfile);

// POST /api/v1/trivida/intel/profile → crée ou met à jour l'IntelProfile
router.post('/profile', protect, withAudit('TRIVIDA_INTEL_UPSERT_PROFILE'), upsertProfile);

module.exports = router;
