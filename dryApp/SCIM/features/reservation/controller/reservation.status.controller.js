const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const {
    buildStatusHistoryEntry,
    decorateReservationForClient,
    formatVisitDate,
    normalizeRequestTypeKey,
    getRequestTypeLabel,
    sendReservationContactNotifications,
    notifyNewMessage,
} = require('./reservation.support.util');

const ALLOWED_STATUSES = new Set(['en_attente', 'confirmee', 'annulee', 'terminee']);

const STAGE_BY_STATUS = {
    confirmee: 'confirmation',
    annulee: 'cancellation',
    terminee: 'completion',
};

const NEXT_STEPS_BY_TYPE = {
    visite: (dateLabel) => `Merci de vous présenter le ${dateLabel}, muni(e) d'une pièce d'identité valide.`,
    location: () => `Notre équipe va vous contacter pour finaliser le dossier de location (pièces, garantie, signature du bail).`,
    achat: () => `Notre équipe va vous contacter pour la suite de l'acquisition (documents, financement, signature de l'acte).`,
};

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Message = req.getModel('Message', MessageSchema);

    const { status } = req.body;
    const nextStatus = String(status || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '').trim();

    if (!ALLOWED_STATUSES.has(nextStatus)) {
        return sendResponse(res, null, 'Statut invalide. Valeurs: en_attente, confirmee, annulee, terminee.', false);
    }

    const reservation = await Reservation.findById(req.params.id)
        .populate('property', 'utilisateur titre')
        .populate('user', 'name nom email telephone');
    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = String(reservation.property?.utilisateur || '') === String(req.user.id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
        return sendResponse(res, null, 'Non autorise.', false);
    }

    if (nextStatus === 'terminee' && String(reservation.status) !== 'confirmee') {
        return sendResponse(res, null, 'Seule une reservation confirmee peut etre marquee comme terminee.', false);
    }

    reservation.status = nextStatus;
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: nextStatus,
            actorId: req.user.id,
            note: reason ? `Statut modifie vers ${nextStatus} — ${reason}` : `Statut modifie vers ${nextStatus} via endpoint status.`,
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

    const clientId = reservation.user?._id || reservation.user;
    const requestTypeKey = normalizeRequestTypeKey(reservation.requestType);
    const requestTypeLabel = getRequestTypeLabel(requestTypeKey);
    const dateLabel = formatVisitDate(reservation.date);
    const ref = reservation.reference || reservation._id;
    const nextSteps = (NEXT_STEPS_BY_TYPE[requestTypeKey] || NEXT_STEPS_BY_TYPE.visite)(dateLabel);

    const statusMessageMap = {
        confirmee: `Bonjour, votre demande de ${requestTypeLabel.toLowerCase()} a été confirmée ! ✅\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n📅 Date confirmée : ${dateLabel}\n\n${nextSteps}`,
        annulee: `Votre demande de ${requestTypeLabel.toLowerCase()} a été annulée.\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n📅 Date concernée : ${dateLabel}${reason ? `\n📝 Motif : ${reason}` : ''}`,
        terminee: `Votre demande de ${requestTypeLabel.toLowerCase()} a été marquée comme terminée. Merci pour votre confiance !\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n\nN'hésitez pas à nous solliciter à nouveau pour vos futurs projets immobiliers.`,
    };

    if (clientId && statusMessageMap[nextStatus]) {
        try {
            const msg = await Message.create({
                expediteur: req.user.id,
                destinataire: clientId,
                sujet: `${requestTypeLabel} ${nextStatus === 'confirmee' ? 'confirmée' : nextStatus === 'annulee' ? 'annulée' : 'terminée'} — ${reservation.property?.titre || 'votre bien'}`,
                contenu: statusMessageMap[nextStatus],
            });
            await notifyNewMessage(req, Message, msg);
        } catch (_) {}
    }

    if (STAGE_BY_STATUS[nextStatus]) {
        try {
            await sendReservationContactNotifications({
                reservation,
                user: reservation.user,
                propertyTitle: reservation.property?.titre,
                visitDate: reservation.date,
                stage: STAGE_BY_STATUS[nextStatus],
                reason,
            });
        } catch (_) {}
    }

    return sendResponse(res, decorateReservationForClient(reservation), 'Statut de reservation mis a jour.');
});
