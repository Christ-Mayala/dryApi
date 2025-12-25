const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const match = {
        isDeleted: false,
        $and: [
            {
                $or: [{ status: 'active' }, { status: { $exists: false } }],
            },
        ],
    };

    const [totals] = await Property.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalProperties: { $sum: 1 },
                totalViews: { $sum: { $ifNull: ['$vues', 0] } },
                averagePrice: { $avg: '$prix' },
            },
        },
    ]);

    const [mostViewedTypeAgg] = await Property.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$categorie',
                views: { $sum: { $ifNull: ['$vues', 0] } },
                count: { $sum: 1 },
            },
        },
        { $sort: { views: -1 } },
        { $limit: 1 },
    ]);

    const topLocationsAgg = await Property.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$ville',
                count: { $sum: 1 },
                views: { $sum: { $ifNull: ['$vues', 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
    ]);

    const priceBuckets = await Property.aggregate([
        { $match: match },
        {
            $bucket: {
                groupBy: '$prix',
                boundaries: [
                    0,
                    250000,
                    500000,
                    1000000,
                    2500000,
                    5000000,
                    10000000,
                    25000000,
                    50000000,
                    100000000,
                    1000000000000,
                ],
                default: '1000000000000+',
                output: {
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$prix' },
                },
            },
        },
    ]);

    const priceRanges = priceBuckets.map((b) => {
        const key = b._id;
        if (typeof key === 'string') return { range: key, count: b.count || 0, avgPrice: b.avgPrice || 0 };
        const next = Number(key);
        const boundaries = [
            0,
            250000,
            500000,
            1000000,
            2500000,
            5000000,
            10000000,
            25000000,
            50000000,
            100000000,
            1000000000000,
        ];
        const idx = boundaries.indexOf(next);
        const upper = idx >= 0 ? boundaries[idx + 1] : null;
        const label = upper ? `${next}-${upper}` : String(next);
        return { range: label, count: b.count || 0, avgPrice: b.avgPrice || 0 };
    });

    const payload = {
        totalProperties: totals?.totalProperties || 0,
        totalViews: totals?.totalViews || 0,
        averagePrice: Math.round((totals?.averagePrice || 0) * 100) / 100,
        mostViewedType: mostViewedTypeAgg
            ? { category: mostViewedTypeAgg._id || null, views: mostViewedTypeAgg.views || 0, count: mostViewedTypeAgg.count || 0 }
            : null,
        topLocations: (topLocationsAgg || []).map((x) => ({ city: x._id || null, count: x.count || 0, views: x.views || 0 })),
        priceRanges,
    };

    return sendResponse(res, payload, 'Analytics propriétés');
});
