const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const {
    buildStatusHistoryEntry,
    decorateReservationForClient,
    formatVisitDate,
    sendReservationContactNotifications,
    notifyNewMessage,
} = require('./reservation.support.util');

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
            // Notifier le propriétaire que le client annule
            const msg = await Message.create({
                expediteur: req.user.id,
                destinataire: reservation.property.utilisateur,
                sujet: `Visite annulée — ${reservation.property?.titre || 'votre bien'}`,
                contenu: [
                    `Un client a annulé sa demande de visite.`,
                    ``,
                    `📋 Référence : ${ref}`,
                    `🏠 Bien : ${reservation.property?.titre || 'le bien'}`,
                    `📅 Date concernée : ${dateLabel}`,
                ].join('\n'),
            });
            await notifyNewMessage(req, Message, msg);
        } else {
            // Notifier l'utilisateur que sa réservation est annulée (par admin ou propriétaire)
            const msg = await Message.create({
                expediteur: req.user.id,
                destinataire: reservation.user,
                sujet: `Visite annulée — ${reservation.property?.titre || 'votre bien'}`,
                contenu: [
                    `Votre demande de visite a été annulée.`,
                    ``,
                    `📋 Référence : ${ref}`,
                    `🏠 Bien : ${reservation.property?.titre || 'le bien'}`,
                    `📅 Date concernée : ${dateLabel}`,
                    ``,
                    `Si vous avez des questions, n'hésitez pas à nous contacter.`,
                ].join('\n'),
            });
            await notifyNewMessage(req, Message, msg);
        }
    } catch (_) {}

    // Envoyer email de notification si c'est l'admin/proprio qui annule (notifier le client)
    if (!isRequester) {
        try {
            await sendReservationContactNotifications({
                reservation: {
                    ...reservation.toObject({ getters: true }),
                    status: 'annulee',
                },
                user: reservation.user ? { email: reservation.support?.requesterEmail, telephone: reservation.support?.requesterPhone } : null,
                propertyTitle: reservation.property?.titre,
                visitDate: reservation.date,
                stage: 'cancellation',
            });
        } catch (_) {}
    }

    return sendResponse(res, decorateReservationForClient(reservation), 'Reservation annulee.');
});
