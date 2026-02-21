const express = require('express');
const router = express.Router();
const controller = require('../controller/payment.controller');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

router.post('/init', protect, controller.initPayment);
router.get('/verify/:id', protect, controller.verifyPayment);

module.exports = router;