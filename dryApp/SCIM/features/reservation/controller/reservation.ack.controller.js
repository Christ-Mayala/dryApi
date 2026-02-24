const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const { buildStatusHistoryEntry, decorateReservationForClient, findAdminContact, formatVisitDate } = require('./reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const reservation = await Reservation.findById(req.params.id).populate('property', 'titre');
    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isRequester = String(reservation.user) === String(req.user.id);
    if (!isRequester) return sendResponse(res, null, 'Non autorise.', false);

    const statusRaw = String(reservation.status || '').toLowerCase();
    if (!statusRaw.includes('confirm')) {
        return sendResponse(res, null, 'Accuse disponible uniquement pour une reservation confirmee.', false);
    }

    reservation.support = reservation.support || {};
    if (reservation.support.acknowledgedAt) {
        return sendResponse(res, decorateReservationForClient(reservation), 'Accuse deja enregistre.');
    }

    reservation.support.acknowledgedAt = new Date();
    reservation.support.lastContactAt = new Date();
    reservation.support.lastContactChannel = 'client_ack';
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: reservation.status,
            actorId: req.user.id,
            note: 'Accuse reception confirme par client',
            source: 'web',
        }),
    ];

    await reservation.save();

    try {
        const admin = await findAdminContact(User);
        if (admin && String(admin._id) !== String(req.user.id)) {
            const reference = reservation.reference || reservation._id;
            const dateLabel = formatVisitDate(reservation.date);
            await Message.create({
                expediteur: req.user.id,
                destinataire: admin._id,
                sujet: `Accuse reception ${reference}`,
                contenu: [
                    `Le client a accuse reception pour la reservation ${reference}.`,
                    `Date de visite: ${dateLabel}.`,
                    `Bien: "${reservation.property?.titre || 'le bien'}".`,
                ].join('\n'),
            });
        }
    } catch (_) {}

    return sendResponse(res, decorateReservationForClient(reservation), 'Accuse reception enregistre.');
});
