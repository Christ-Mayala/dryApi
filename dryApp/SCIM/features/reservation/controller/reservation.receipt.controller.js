const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PdfService = require('../../../../../dry/services/documents/pdf.service');

const ReservationSchema = require('../model/reservation.schema');
const { decorateReservationForClient } = require('./reservation.support.util');
const { buildReservationReceiptPdf } = require('../../../utils/scimDocument.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const reservation = await Reservation.findById(req.params.id)
        .populate('property', 'titre ville adresse prix devise categorie utilisateur')
        .populate('user', 'name nom email telephone');

    if (!reservation) return sendResponse(res, null, 'Reservation introuvable.', false);

    const isOwner = reservation.property?.utilisateur?.toString() === req.user.id;
    const isRequester = reservation.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isRequester && !isAdmin) return sendResponse(res, null, 'Non autorise.', false);

    const data = decorateReservationForClient(reservation);
    const filename = `recu-${data.reference || data._id}.pdf`;

    return PdfService.stream(
        (doc) => buildReservationReceiptPdf(doc, {
            reservation: data,
            property: reservation.property,
            client: reservation.user,
        }),
        res,
        filename,
    );
});
