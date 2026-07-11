const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');

const parseRangeDate = (value, fallback) => {
    const d = value ? new Date(value) : fallback;
    return Number.isNaN(d?.getTime()) ? fallback : d;
};

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    // Portefeuille complet (toutes annonces non supprimées, actives ou suspendues).
    const baseMatch = { isDeleted: false };
    const activeMatch = { isDeleted: false, $or: [{ status: 'active' }, { status: { $exists: false } }] };
    const inactiveMatch = { isDeleted: false, status: 'inactive' };

    const from = new Date();
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    // Periode optionnelle (filtres Semaine/Mois/Trimestre/Annee de la page Statistiques) :
    // ne restreint que le compteur "nouveaux biens", pas la taille globale du catalogue.
    const periodFrom = req.query.from ? parseRangeDate(req.query.from, null) : null;
    const periodTo = req.query.to ? parseRangeDate(req.query.to, null) : null;
    const periodMatch = (periodFrom || periodTo)
        ? { ...baseMatch, createdAt: { ...(periodFrom ? { $gte: periodFrom } : {}), ...(periodTo ? { $lte: periodTo } : {}) } }
        : null;

    const [
        [totals],
        activeProperties,
        inactiveProperties,
        [mostViewedTypeAgg],
        topLocationsAgg,
        priceBuckets,
        propertiesByCategoryAgg,
        publicationTrendAgg,
        topViewedProperties,
    ] = await Promise.all([
        Property.aggregate([
            { $match: baseMatch },
            {
                $group: {
                    _id: null,
                    totalProperties: { $sum: 1 },
                    totalViews: { $sum: { $ifNull: ['$vues', 0] } },
                    averagePrice: { $avg: '$prix' },
                },
            },
        ]),
        Property.countDocuments(activeMatch),
        Property.countDocuments(inactiveMatch),
        Property.aggregate([
            { $match: baseMatch },
            { $group: { _id: '$categorie', views: { $sum: { $ifNull: ['$vues', 0] } }, count: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 1 },
        ]),
        Property.aggregate([
            { $match: baseMatch },
            { $group: { _id: '$ville', count: { $sum: 1 }, views: { $sum: { $ifNull: ['$vues', 0] } } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
        ]),
        Property.aggregate([
            { $match: baseMatch },
            {
                $bucket: {
                    groupBy: '$prix',
                    boundaries: [0, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000, 1000000000000],
                    default: '1000000000000+',
                    output: { count: { $sum: 1 }, avgPrice: { $avg: '$prix' } },
                },
            },
        ]),
        Property.aggregate([
            { $match: baseMatch },
            { $group: { _id: '$categorie', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        Property.aggregate([
            { $match: { ...baseMatch, createdAt: { $gte: from } } },
            {
                $group: {
                    _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.y': 1, '_id.m': 1 } },
        ]),
        Property.find(baseMatch).select('titre ville vues').sort({ vues: -1 }).limit(8).lean(),
    ]);

    const distinctOwners = (await Property.distinct('utilisateur', baseMatch)).filter(Boolean).length;
    const newProperties = periodMatch ? await Property.countDocuments(periodMatch) : null;

    const priceBoundaries = [0, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000, 1000000000000];
    const priceRanges = priceBuckets.map((b) => {
        const key = b._id;
        if (typeof key === 'string') return { range: key, count: b.count || 0, avgPrice: b.avgPrice || 0 };
        const idx = priceBoundaries.indexOf(Number(key));
        const upper = idx >= 0 ? priceBoundaries[idx + 1] : null;
        const label = upper ? `${key}-${upper}` : String(key);
        return { range: label, count: b.count || 0, avgPrice: b.avgPrice || 0 };
    });

    const publicationTrend = (publicationTrendAgg || []).map((x) => {
        const y = x._id?.y;
        const m = x._id?.m;
        const label = y && m ? `${String(y)}-${String(m).padStart(2, '0')}` : null;
        return { month: label, count: x.count || 0 };
    });

    const payload = {
        totalProperties: totals?.totalProperties || 0,
        activeProperties: activeProperties || 0,
        inactiveProperties: inactiveProperties || 0,
        totalViews: totals?.totalViews || 0,
        averagePrice: Math.round((totals?.averagePrice || 0) * 100) / 100,
        mostViewedType: mostViewedTypeAgg
            ? { category: mostViewedTypeAgg._id || null, views: mostViewedTypeAgg.views || 0, count: mostViewedTypeAgg.count || 0 }
            : null,
        topLocations: (topLocationsAgg || []).map((x) => ({ city: x._id || null, count: x.count || 0, views: x.views || 0 })),
        priceRanges,
        propertiesByCategory: (propertiesByCategoryAgg || []).map((x) => ({ category: x._id || 'Autre', count: x.count || 0 })),
        publicationTrend,
        topViewedProperties: (topViewedProperties || []).map((p) => ({ titre: p.titre, ville: p.ville, vues: p.vues || 0 })),
        distinctOwners,
        newProperties,
    };

    return sendResponse(res, payload, 'Analytics proprietes');
});
