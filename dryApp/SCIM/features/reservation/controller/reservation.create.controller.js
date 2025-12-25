const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReservationSchema = require('../model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Property = req.getModel('Property', PropertySchema);
    const Message = req.getModel('Message', MessageSchema);

    const { propertyId, date } = req.body;
    const userId = req.user.id;

    if (!propertyId || !date) return sendResponse(res, null, 'propertyId et date sont requis.', false);

    const offsetMinutes = Number(process.env.SCIM_TZ_OFFSET_MINUTES || 60);

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

    if (isNaN(when.getTime())) return sendResponse(res, null, 'Date invalide.', false);
    if (when < new Date()) return sendResponse(res, null, 'La date de réservation doit être dans le futur.', false);

    const localMinutes = ((((when.getUTCHours() * 60 + when.getUTCMinutes()) + offsetMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
    if (localMinutes < 10 * 60 || localMinutes > 17 * 60) {
        return sendResponse(res, null, 'Réservation possible uniquement entre 10h00 et 17h00.', false);
    }

    const property = await Property.findById(propertyId).select('_id titre utilisateur isDeleted').populate('utilisateur', 'name nom email');
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    let reservation;
    try {
        reservation = await Reservation.create({
            property: propertyId,
            user: userId,
            date: when,
            status: 'en attente',
        });
    } catch (e) {
        const msg = e?.name === 'ValidationError' ? 'Réservation invalide.' : 'Erreur lors de la création de la réservation.';
        return sendResponse(res, null, msg, false);
    }

    try {
        if (property.utilisateur && property.utilisateur._id.toString() !== userId.toString()) {
            const contenu = `Nouvelle demande de réservation pour le bien "${property.titre}" le ${when.toLocaleDateString()} (ID réservation: ${reservation._id}).`;
            await Message.create({ expediteur: userId, destinataire: property.utilisateur._id, contenu });
        }
    } catch (_) {}

    return sendResponse(res, reservation, 'Réservation créée avec succès.');
});
