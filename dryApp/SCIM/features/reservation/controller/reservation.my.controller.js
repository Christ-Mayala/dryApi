const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const { decorateReservationCollectionForClient } = require('./reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    req.getModel('User');
    req.getModel('Property', PropertySchema);

    const reservations = await Reservation.find({ user: req.user.id })
        .populate('property', 'titre ville adresse prix categorie images utilisateur')
        .sort({ createdAt: -1 });

    return sendResponse(res, { reservations: decorateReservationCollectionForClient(reservations) }, 'Mes reservations');
});
