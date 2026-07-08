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

    const reservation = await Reservation.findById(req.params.id)
        .populate('property', 'utilisateur titre')
        .populate('user', 'name nom email telephone');

    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = reservation.property?.utilisateur?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return sendResponse(res, null, 'Non autorise.', false);

    const statusRaw = String(reservation.status || '').toLowerCase();
    if (statusRaw.includes('confirm')) {
        return sendResponse(res, decorateReservationForClient(reservation), 'Reservation deja confirmee.');
    }

    reservation.status = 'confirmee';
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: 'confirmee',
            actorId: req.user.id,
            note: isAdmin ? 'Confirmee par administration' : 'Confirmee par proprietaire',
        }),
    ];

    reservation.support = reservation.support || {};
    reservation.support.reference = reservation.support.reference || reservation.reference || String(reservation._id);
    reservation.support.requesterPhone = reservation.support.requesterPhone || reservation.user?.telephone || '';
    reservation.support.requesterEmail = reservation.support.requesterEmail || reservation.user?.email || '';
    reservation.support.confirmedAt = new Date();
    reservation.support.reminderSentAt = null;
    reservation.support.reminderAttempts = 0;
    reservation.support.lastContactAt = new Date();
    reservation.support.lastContactChannel = 'internal_message';

    await reservation.save();

    try {
        const dateLabel = formatVisitDate(reservation.date);
        const ref = reservation.reference || reservation._id;
        const lines = [
            `Bonjour, votre demande de visite a été confirmée ! ✅`,
            ``,
            `📋 Référence : ${ref}`,
            `🏠 Bien : ${reservation.property?.titre || 'le bien'}`,
            `📅 Date confirmée : ${dateLabel}`,
            ``,
            `Merci de nous confirmer la réception de ce message en répondant à cette conversation.`,
        ];

        if (reservation.support?.whatsappUrl) {
            lines.push(``, `Vous pouvez aussi nous contacter via WhatsApp : ${reservation.support.whatsappUrl}`);
        }

        const msg = await Message.create({
            expediteur: req.user.id,
            destinataire: reservation.user?._id || reservation.user,
            sujet: `Visite confirmée — ${reservation.property?.titre || 'votre bien'}`,
            contenu: lines.join('\n'),
        });
        await notifyNewMessage(req, Message, msg);
    } catch (_) {}

    try {
        const report = await sendReservationContactNotifications({
            reservation,
            user: reservation.user,
            propertyTitle: reservation.property?.titre,
            visitDate: reservation.date,
            stage: 'confirmation',
        });

        reservation.support.lastContactAt = new Date();
        reservation.support.lastContactChannel = report.primaryChannel || reservation.support.lastContactChannel || '';
        await reservation.save();
    } catch (_) {}

    return sendResponse(res, decorateReservationForClient(reservation), 'Reservation confirmee.');
});
