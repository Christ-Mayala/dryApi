const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PdfService = require('../../../../../dry/services/documents/pdf.service');

const ReservationSchema = require('../model/reservation.schema');
const { decorateReservationForClient, normalizeRequestTypeKey } = require('./reservation.support.util');
const { buildReservationContractPdf } = require('../../../utils/scimDocument.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const reservation = await Reservation.findById(req.params.id)
        .populate({
            path: 'property',
            select: 'titre ville adresse prix devise categorie utilisateur',
            populate: { path: 'utilisateur', select: 'name nom email telephone' },
        })
        .populate('user', 'name nom email telephone');

    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = reservation.property?.utilisateur?._id?.toString() === req.user.id;
    const isRequester = reservation.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorise.', false);

    const requestType = normalizeRequestTypeKey(reservation.requestType);
    if (requestType === 'visite') {
        return sendResponse(res, null, 'Aucun contrat ne s\'applique a une simple demande de visite.', false);
    }

    const statusRaw = String(reservation.status || '').toLowerCase();
    if (!statusRaw.includes('confirm')) {
        return sendResponse(res, null, 'Le contrat est disponible uniquement pour une reservation confirmee.', false);
    }

    const data = decorateReservationForClient(reservation);
    const filename = `contrat-${data.reference || data._id}.pdf`;

    return PdfService.stream(
        (doc) => buildReservationContractPdf(doc, {
            reservation: data,
            property: reservation.property,
            client: reservation.user,
            owner: reservation.property?.utilisateur,
        }),
        res,
        filename,
    );
});
