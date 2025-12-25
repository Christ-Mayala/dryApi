const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReservationSchema = require('../model/reservation.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const r = await Reservation.findById(req.params.id).populate('property', 'utilisateur');
    if (!r) return sendResponse(res, null, 'Réservation introuvable.', false);

    const isOwner = r.property?.utilisateur?.toString() === req.user.id;
    const isRequester = r.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorisé.', false);

    r.status = 'annulée';
    await r.save();

    return sendResponse(res, r, 'Réservation annulée.');
});
