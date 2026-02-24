const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const { buildStatusHistoryEntry, decorateReservationForClient, formatVisitDate } = require('./reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Message = req.getModel('Message', MessageSchema);

    const reservation = await Reservation.findById(req.params.id).populate('property', 'utilisateur titre');
    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = reservation.property?.utilisateur?.toString() === req.user.id;
    const isRequester = reservation.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorise.', false);

    const statusRaw = String(reservation.status || '').toLowerCase();
    if (statusRaw.includes('annul')) {
        return sendResponse(res, decorateReservationForClient(reservation), 'Reservation deja annulee.');
    }

    reservation.status = 'annulee';
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: 'annulee',
            actorId: req.user.id,
            note: isRequester ? 'Annulee par client' : isAdmin ? 'Annulee par administration' : 'Annulee par proprietaire',
        }),
    ];

    await reservation.save();

    try {
        const ref = reservation.reference || reservation._id;
        const dateLabel = formatVisitDate(reservation.date);
        const isClientCancelling = isRequester && !isOwner && !isAdmin;

        if (isClientCancelling && reservation.property?.utilisateur && String(reservation.property.utilisateur) !== String(req.user.id)) {
            const ownerLines = [
                `Le client a annule la reservation ${ref}.`,
                `Bien: "${reservation.property?.titre || 'le bien'}".`,
                `Date demandee: ${dateLabel}.`,
            ];

            await Message.create({
                expediteur: req.user.id,
                destinataire: reservation.property.utilisateur,
                sujet: `Reservation ${ref} annulee`,
                contenu: ownerLines.join('\n'),
            });
        } else {
            const userLines = [
                `La reservation ${ref} pour "${reservation.property?.titre || 'le bien'}" a ete annulee.`,
                `Date concernee: ${dateLabel}.`,
            ];
            await Message.create({
                expediteur: req.user.id,
                destinataire: reservation.user,
                sujet: `Reservation ${ref} annulee`,
                contenu: userLines.join('\n'),
            });
        }
    } catch (_) {}

    return sendResponse(res, decorateReservationForClient(reservation), 'Reservation annulee.');
});
