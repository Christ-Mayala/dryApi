const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ReservationSchema = require('../../reservation/model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const { CONFIRMED_STATUS_VALUES } = require('../../reservation/controller/reservation.support.util');

const parseRangeDate = (value, fallback) => {
    const d = value ? new Date(value) : fallback;
    return Number.isNaN(d?.getTime()) ? fallback : d;
};

module.exports = asyncHandler(async (req, res) => {
    const Reservation = req.getModel('Reservation', ReservationSchema);
    const Property = req.getModel('Property', PropertySchema);

    const propertiesCollection = Property.collection.name;

    // Periode optionnelle (filtres Semaine/Mois/Trimestre/Annee de la page Statistiques).
    const from = req.query.from ? parseRangeDate(req.query.from, null) : null;
    const to = req.query.to ? parseRangeDate(req.query.to, null) : null;
    const dateMatch = {};
    if (from) dateMatch.$gte = from;
    if (to) dateMatch.$lte = to;

    const baseMatch = { status: { $in: CONFIRMED_STATUS_VALUES } };
    if (from || to) baseMatch.createdAt = dateMatch;

    const pipeline = [
        { $match: baseMatch },
        {
            $lookup: {
                from: propertiesCollection,
                localField: 'property',
                foreignField: '_id',
                as: 'propertyDoc',
            },
        },
        { $unwind: { path: '$propertyDoc', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                amount: { $ifNull: ['$propertyDoc.prix', 0] },
            },
        },
    ];

    const [totals] = await Reservation.aggregate([
        ...pipeline,
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalConfirmedReservations: { $sum: 1 },
            },
        },
    ]);

    const monthlyAgg = await Reservation.aggregate([
        ...pipeline,
        {
            $group: {
                _id: {
                    y: { $year: '$date' },
                    m: { $month: '$date' },
                },
                revenue: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    const revenueByTypeAgg = await Reservation.aggregate([
        ...pipeline,
        {
            $group: {
                _id: '$propertyDoc.transactionType',
                revenue: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { revenue: -1 } },
    ]);

    const monthlyRevenue = (monthlyAgg || []).map((x) => {
        const y = x._id?.y;
        const m = x._id?.m;
        const label = y && m ? `${String(y)}-${String(m).padStart(2, '0')}` : null;
        return { month: label, revenue: x.revenue || 0, count: x.count || 0 };
    });

    const payload = {
        totalRevenue: totals?.totalRevenue || 0,
        totalConfirmedReservations: totals?.totalConfirmedReservations || 0,
        monthlyRevenue,
        revenueByType: (revenueByTypeAgg || []).map((x) => ({ type: x._id || 'unknown', revenue: x.revenue || 0, count: x.count || 0 })),
    };

    return sendResponse(res, payload, 'Analytics revenus');
});
