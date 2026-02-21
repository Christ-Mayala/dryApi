const express = require('express');
const router = express.Router();
const controller = require('../controller/export.controller');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

router.get('/', protect, controller.exportData);

module.exports = router;