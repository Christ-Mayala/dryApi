const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const parseRangeDate = (value, fallback) => {
    const d = value ? new Date(value) : fallback;
    return Number.isNaN(d?.getTime()) ? fallback : d;
};

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const match = { deleted: { $ne: true }, status: { $ne: 'deleted' } };

    // Periode optionnelle (filtres Semaine/Mois/Trimestre/Annee de la page Statistiques).
    const from = req.query.from ? parseRangeDate(req.query.from, null) : null;
    const to = req.query.to ? parseRangeDate(req.query.to, null) : null;

    const [totals, newUsers] = await Promise.all([
        User.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
                        },
                    },
                },
            },
        ]),
        (from || to)
            ? User.countDocuments({
                ...match,
                createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) },
            })
            : null,
    ]);

    const usersByRoleAgg = await User.aggregate([
        { $match: match },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const growthFrom = new Date();
    growthFrom.setMonth(growthFrom.getMonth() - 11);
    growthFrom.setDate(1);
    growthFrom.setHours(0, 0, 0, 0);

    const userGrowthAgg = await User.aggregate([
        { $match: { ...match, createdAt: { $gte: growthFrom } } },
        {
            $group: {
                _id: {
                    y: { $year: '$createdAt' },
                    m: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    const userGrowth = (userGrowthAgg || []).map((x) => {
        const y = x._id?.y;
        const m = x._id?.m;
        const label = y && m ? `${String(y)}-${String(m).padStart(2, '0')}` : null;
        return { month: label, count: x.count || 0 };
    });

    const totalsRow = Array.isArray(totals) ? totals[0] : totals;

    const payload = {
        totalUsers: totalsRow?.totalUsers || 0,
        totalRegistrations: totalsRow?.totalUsers || 0,
        activeUsers: totalsRow?.activeUsers || 0,
        newUsers: newUsers === null ? null : newUsers || 0,
        usersByRole: (usersByRoleAgg || []).map((x) => ({ role: x._id || 'user', count: x.count || 0 })),
        userGrowth,
    };

    return sendResponse(res, payload, 'Analytics utilisateurs');
});
