const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReservationSchema = require('../model/reservation.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const r = await Reservation.findById(req.params.id)
        .populate('property', 'titre ville adresse prix categorie images utilisateur')
        .populate('user', 'name nom email');

    if (!r) return sendResponse(res, null, 'Réservation introuvable.', false);

    const isOwner = r.property?.utilisateur?.toString() === req.user.id;
    const isRequester = r.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorisé.', false);

    return sendResponse(res, r, 'Détail réservation');
});
