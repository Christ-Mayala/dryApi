const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReservationSchema = require('../../reservation/model/reservation.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const { id } = req.params;
    const { status } = req.body;

    if (!['confirmee', 'annulee', 'en_attente'].includes(status)) {
        return sendResponse(res, null, 'Statut invalide', false);
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
        return sendResponse(res, null, 'Visite introuvable', false);
    }

    reservation.status = status;
    await reservation.save();

    return sendResponse(res, reservation, 'Statut de la visite mis à jour');
});
