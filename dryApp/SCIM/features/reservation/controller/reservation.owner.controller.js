const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');

    const ownerId = req.user.id;
    const properties = await Property.find({ utilisateur: ownerId, isDeleted: false }).select('_id');
    const propIds = properties.map((p) => p._id);

    const reservations = await Reservation.find({ property: { $in: propIds } })
        .populate('property', 'titre ville adresse prix categorie images utilisateur')
        .populate('user', 'name nom email')
        .sort({ createdAt: -1 });

    return sendResponse(res, { reservations }, 'Réservations reçues');
});
