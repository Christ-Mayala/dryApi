const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const { buildStatusHistoryEntry, decorateReservationForClient } = require('./reservation.support.util');

const ALLOWED_STATUSES = new Set(['en_attente', 'confirmee', 'annulee']);

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const { status } = req.body;
    const nextStatus = String(status || '').trim().toLowerCase();

    if (!ALLOWED_STATUSES.has(nextStatus)) {
        return sendResponse(res, null, 'Statut invalide. Valeurs: en_attente, confirmee, annulee.', false);
    }

    const reservation = await Reservation.findById(req.params.id).populate('property', 'utilisateur');
    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = String(reservation.property?.utilisateur || '') === String(req.user.id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
        return sendResponse(res, null, 'Non autorise.', false);
    }

    reservation.status = nextStatus;
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: nextStatus,
            actorId: req.user.id,
            note: `Statut modifie vers ${nextStatus} via endpoint status.`,
            source: 'web',
        }),
    ];

    reservation.support = reservation.support || {};
    reservation.support.lastContactAt = new Date();
    reservation.support.lastContactChannel = 'status_update';
    if (nextStatus === 'confirmee' && !reservation.support.confirmedAt) {
        reservation.support.confirmedAt = new Date();
    }

    await reservation.save();

    return sendResponse(res, decorateReservationForClient(reservation), 'Statut de reservation mis a jour.');
});
