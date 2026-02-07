const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Message = req.getModel('Message', MessageSchema);

    const r = await Reservation.findById(req.params.id).populate('property', 'utilisateur titre');
    if (!r) return sendResponse(res, null, 'Réservation introuvable.', false);

    const isOwner = r.property?.utilisateur?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return sendResponse(res, null, 'Non autorisé.', false);

    r.status = 'confirmée';
    await r.save();

    try {
        const contenu = `Votre réservation pour "${r.property.titre}" le ${new Date(r.date).toLocaleDateString()} a été confirmée.`;
        await Message.create({ expediteur: req.user.id, destinataire: r.user, contenu });
    } catch (_) {}

    return sendResponse(res, r, 'Réservation confirmée.');
});
