const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

const createReservation = require('../controller/reservation.create.controller');
const getMyReservations = require('../controller/reservation.my.controller');
const getOwnerReservations = require('../controller/reservation.owner.controller');
const cancelReservation = require('../controller/reservation.cancel.controller');
const confirmReservation = require('../controller/reservation.confirm.controller');
const getReservationById = require('../controller/reservation.get.controller');

router.post('/', protect, createReservation);
router.get('/my', protect, getMyReservations);
router.get('/owner', protect, getOwnerReservations);
router.patch('/:id/cancel', protect, cancelReservation);
router.patch('/:id/confirm', protect, confirmReservation);
router.get('/:id', protect, getReservationById);

module.exports = router;
