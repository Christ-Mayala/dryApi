const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const { decorateReservationForClient } = require('./reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const reservation = await Reservation.findById(req.params.id)
        .populate('property', 'titre ville adresse prix categorie images utilisateur')
        .populate('user', 'name nom email telephone');

    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = reservation.property?.utilisateur?.toString() === req.user.id;
    const isRequester = reservation.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorise.', false);

    return sendResponse(res, decorateReservationForClient(reservation), 'Detail reservation');
});
