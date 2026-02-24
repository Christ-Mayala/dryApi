const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../../reservation/model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const { decorateReservationCollectionForClient } = require('../../reservation/controller/reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    req.getModel('Property', PropertySchema);

    const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Reservation.countDocuments({});

    const reservations = await Reservation.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('property', 'titre ville adresse prix devise categorie images utilisateur isBonPlan bonPlanLabel bonPlanExpiresAt')
        .populate('user', 'name nom email telephone role');

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return sendResponse(
        res,
        {
            reservations: decorateReservationCollectionForClient(reservations),
            page,
            currentPage: page,
            limit,
            total,
            totalPages,
        },
        'Reservations',
    );
});
