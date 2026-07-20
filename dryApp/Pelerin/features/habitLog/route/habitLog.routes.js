const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const toggle = require('../controller/habitLog.toggle.controller');
const getAll = require('../controller/habitLog.getAll.controller');

router.use(protect);

router.get('/', getAll);
router.post('/toggle', withAudit('HABITLOG_TOGGLE'), toggle);

module.exports = router;
