const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReservationSchema = require('../../reservation/model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const {
    buildStatusHistoryEntry,
    decorateReservationForClient,
    formatVisitDate,
    normalizeRequestTypeKey,
    getRequestTypeLabel,
    sendReservationContactNotifications,
    notifyNewMessage,
} = require('../../reservation/controller/reservation.support.util');

const ALLOWED_STATUSES = ['confirmee', 'annulee', 'en_attente', 'terminee'];

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
    const { id } = req.params;
    const { status } = req.body;
    const reason = String(req.body?.reason || '').trim();

    if (!ALLOWED_STATUSES.includes(status)) {
        return sendResponse(res, null, 'Statut invalide', false);
    }

    const reservation = await Reservation.findById(id)
        .populate('property', 'titre ville utilisateur')
        .populate('user', 'name nom email telephone');

    if (!reservation) {
        return sendResponse(res, null, 'Visite introuvable', false);
    }

    if (status === 'terminee' && String(reservation.status) !== 'confirmee') {
        return sendResponse(res, null, "Seule une réservation confirmée peut être marquée comme terminée.", false);
    }

    reservation.status = status;
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status,
            actorId: req.user.id,
            note: reason ? `Statut modifié vers ${status} par l'administration — ${reason}` : `Statut modifié vers ${status} par l'administration.`,
            source: 'admin',
        }),
    ];

    reservation.support = reservation.support || {};
    if (status === 'confirmee' && !reservation.support.confirmedAt) {
        reservation.support.confirmedAt = new Date();
    }
    reservation.support.lastContactAt = new Date();
    reservation.support.lastContactChannel = 'admin_status_update';

    await reservation.save();

    const requestTypeKey = normalizeRequestTypeKey(reservation.requestType);
    const requestTypeLabel = getRequestTypeLabel(requestTypeKey);
    const dateLabel = formatVisitDate(reservation.date);
    const ref = reservation.reference || reservation._id;
    const clientId = reservation.user?._id || reservation.user;
    const nextSteps = (NEXT_STEPS_BY_TYPE[requestTypeKey] || NEXT_STEPS_BY_TYPE.visite)(dateLabel);

    const statusMessageMap = {
        confirmee: `Bonjour, votre demande de ${requestTypeLabel.toLowerCase()} a été confirmée ! ✅\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n📅 Date confirmée : ${dateLabel}\n\n${nextSteps}`,
        annulee: `Votre demande de ${requestTypeLabel.toLowerCase()} a été annulée.\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n📅 Date concernée : ${dateLabel}${reason ? `\n📝 Motif : ${reason}` : ''}`,
        terminee: `Votre demande de ${requestTypeLabel.toLowerCase()} a été marquée comme terminée. Merci pour votre confiance !\n\n📋 Référence : ${ref}\n🏠 Bien : ${reservation.property?.titre || 'le bien'}\n\nN'hésitez pas à nous solliciter à nouveau pour vos futurs projets immobiliers.`,
    };

    if (clientId && statusMessageMap[status]) {
        try {
            const msg = await Message.create({
                expediteur: req.user.id,
                destinataire: clientId,
                sujet: `${requestTypeLabel} ${status === 'confirmee' ? 'confirmée' : status === 'annulee' ? 'annulée' : 'terminée'} — ${reservation.property?.titre || 'votre bien'}`,
                contenu: statusMessageMap[status],
            });
            await notifyNewMessage(req, Message, msg);
        } catch (_) {}
    }

    if (STAGE_BY_STATUS[status]) {
        try {
            await sendReservationContactNotifications({
                reservation,
                user: reservation.user,
                propertyTitle: reservation.property?.titre,
                visitDate: reservation.date,
                stage: STAGE_BY_STATUS[status],
                reason,
            });
        } catch (_) {}
    }

    return sendResponse(res, decorateReservationForClient(reservation), 'Statut de la visite mis à jour');
});
