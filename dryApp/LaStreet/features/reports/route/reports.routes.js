const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const createReport = require('../controller/reports.create.controller');

router.post('/', protect, withAudit('REPORT_PROFILE'), createReport);

module.exports = router;
