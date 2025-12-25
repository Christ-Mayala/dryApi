const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReservationSchema = require('../model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    req.getModel('User');
    req.getModel('Property', PropertySchema);

    const reservations = await Reservation.find({ user: req.user.id })
        .populate('property', 'titre ville adresse prix categorie images utilisateur')
        .sort({ createdAt: -1 });

    return sendResponse(res, { reservations }, 'Mes réservations');
});
