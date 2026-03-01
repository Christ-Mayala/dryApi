const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const logger = require('../../../../../dry/utils/logging/logger');

const ReservationSchema = require('../model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const MessageSchema = require('../../message/model/message.schema');
const UserSchema = require('../../users/model/userPublic.schema.js');

const {
    buildReservationReference,
    buildSupportPayload,
    buildStatusHistoryEntry,
    decorateReservationForClient,
    findAdminContact,
    formatVisitDate,
    isValidContactPhone,
    normalizePhoneE164,
    sendAdminWhatsAppNotification,
} = require('./reservation.support.util');
const config = require('../../../../../config/database');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Property = req.getModel('Property', PropertySchema);
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User', UserSchema);

    const { propertyId, date, telephone, isWhatsapp } = req.body;
    const userId = req.user.id;

    if (!propertyId || !date) return sendResponse(res, null, 'propertyId et date sont requis.', false);

    const offsetMinutes = Number(config.SCIM_TZ_OFFSET_MINUTES || 60);

    const parseAsScimLocal = (value) => {
        const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!m) return null;

        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const h = Number(m[4]);
        const mi = Number(m[5]);

        if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;

        const utcMs = Date.UTC(y, mo - 1, d, h, mi) - offsetMinutes * 60 * 1000;
        return new Date(utcMs);
    };

    const hasExplicitTz = typeof date === 'string' && (date.endsWith('Z') || /[+-]\d\d:\d\d$/.test(date));
    const when = !hasExplicitTz ? parseAsScimLocal(date) || new Date(date) : new Date(date);

    if (Number.isNaN(when.getTime())) return sendResponse(res, null, 'Date invalide.', false);
    if (when < new Date()) return sendResponse(res, null, 'La date de reservation doit etre dans le futur.', false);

    const localMinutes = ((((when.getUTCHours() * 60 + when.getUTCMinutes()) + offsetMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
    if (localMinutes < 10 * 60 || localMinutes > 17 * 60) {
        return sendResponse(res, null, 'Reservation possible uniquement entre 10h00 et 17h00.', false);
    }

    const requester = await User.findById(userId).select('_id name nom email telephone');
    if (!requester) return sendResponse(res, null, 'Utilisateur introuvable.', false);

    const bodyPhoneRaw = String(telephone || '').trim();
    const fallbackPhoneRaw = String(requester.telephone || '').trim();
    const effectivePhoneRaw = fallbackPhoneRaw || bodyPhoneRaw;

    if (!effectivePhoneRaw) {
        return sendResponse(res, null, 'Numero de telephone requis pour reserver.', false);
    }

    if (!isValidContactPhone(effectivePhoneRaw)) {
        return sendResponse(res, null, 'Numero de telephone invalide pour la reservation.', false);
    }

    const requesterPhone = normalizePhoneE164(effectivePhoneRaw);
    if (!fallbackPhoneRaw && requesterPhone) {
        requester.telephone = requesterPhone;
        await requester.save();
    }

    const property = await Property.findById(propertyId)
        .select('_id titre utilisateur isDeleted')
        .populate('utilisateur', 'name nom email telephone role');

    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    if (property.utilisateur && String(property.utilisateur._id) === String(userId)) {
        return sendResponse(res, null, 'Vous ne pouvez pas reserver votre propre bien.', false);
    }

    let reservation;
    try {
        reservation = await Reservation.create({
            property: propertyId,
            user: userId,
            date: when,
            telephone: requesterPhone,
            isWhatsapp: Boolean(isWhatsapp),
            status: 'en_attente',
        });
    } catch (e) {
        const msg = e?.name === 'ValidationError' ? 'Reservation invalide.' : 'Erreur lors de la creation de la reservation.';
        return sendResponse(res, null, msg, false);
    }

    reservation.reference = buildReservationReference({ createdAt: reservation.createdAt, objectId: reservation._id });
    const support = buildSupportPayload({
        reference: reservation.reference,
        propertyTitle: property.titre,
        visitDate: when,
        requesterPhone,
        requesterEmail: requester.email || '',
    });

    reservation.support = support;
    reservation.statusHistory = [
        buildStatusHistoryEntry({
            status: reservation.status,
            actorId: userId,
            note: 'Demande creee via site web',
        }),
    ];

    await reservation.save();

    try {
        if (property.utilisateur && property.utilisateur._id.toString() !== userId.toString()) {
            const dateLabel = formatVisitDate(when);
            const ownerContent = [
                `Nouvelle demande de reservation ${reservation.reference}.`,
                `Bien: "${property.titre}".`,
                `Date demandee: ${dateLabel}.`,
            ].join('\n');

            await Message.create({
                expediteur: userId,
                destinataire: property.utilisateur._id,
                sujet: `Reservation ${reservation.reference}`,
                contenu: ownerContent,
            });
        }
    } catch (_) {}

    try {
        const adminUser = await findAdminContact(User);
        if (adminUser && String(adminUser._id) !== String(userId)) {
            const lines = [
                `Votre reservation ${reservation.reference} a bien ete enregistree.`,
                `Bien: "${property.titre}".`,
                support.asyncNotice,
            ];

            if (support.whatsappUrl) {
                lines.push(`Si besoin urgent, continuez sur WhatsApp: ${support.whatsappUrl}`);
            }

            await Message.create({
                expediteur: adminUser._id,
                destinataire: userId,
                sujet: `Confirmation ${reservation.reference}`,
                contenu: lines.join('\n'),
            });
        }

        // Envoyer notification WhatsApp à l'admin
        try {
            await sendAdminWhatsAppNotification({
                reservation,
                propertyTitle: property.titre,
                requesterPhone,
                isWhatsapp: Boolean(isWhatsapp),
            });
        } catch (error) {
            logger(`Erreur notification WhatsApp admin pour reservation ${reservation.reference}: ${error?.message || error}`, 'warning');
        }

        // Envoyer message interne à l'admin
        try {
            const adminUser = await User.findOne({ role: 'admin' }).select('_id');
            if (adminUser) {
                const messageContent = `🏠 NOUVELLE RÉSERVATION\n\n` +
                    `📋 Référence: ${reservation.reference}\n` +
                    `🏠 Bien: ${property.titre}\n` +
                    `📅 Date: ${formatVisitDate(date)}\n` +
                    `📞 Téléphone: ${telephone}${isWhatsapp ? ' (WhatsApp)' : ''}\n` +
                    `👤 Client: ${user?.name || user?.nom || 'Client'}\n` +
                    `📊 Statut: En attente de confirmation\n\n` +
                    `Veuillez traiter cette demande dans le panel d'administration.`;

                await Message.create({
                    expediteur: user._id,
                    destinataire: adminUser._id,
                    sujet: `Nouvelle réservation - ${property.titre}`,
                    contenu: messageContent,
                    type: 'reservation',
                    referenceId: reservation._id
                });
            }
        } catch (error) {
            logger(`Erreur message interne admin pour reservation ${reservation.reference}: ${error?.message || error}`, 'warning');
        }
    } catch (_) {}

    const reservationData = decorateReservationForClient(reservation);

    return sendResponse(
        res,
        {
            reservation: reservationData,
            support: reservationData.support || support,
        },
        'Reservation enregistree avec succes.',
    );
});
