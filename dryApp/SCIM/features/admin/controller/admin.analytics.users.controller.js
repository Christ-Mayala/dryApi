const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const match = { deleted: { $ne: true }, status: { $ne: 'deleted' } };

    const [totals] = await User.aggregate([
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
    ]);

    const usersByRoleAgg = await User.aggregate([
        { $match: match },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const from = new Date();
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const userGrowthAgg = await User.aggregate([
        { $match: { ...match, createdAt: { $gte: from } } },
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

    const payload = {
        totalUsers: totals?.totalUsers || 0,
        totalRegistrations: totals?.totalUsers || 0,
        activeUsers: totals?.activeUsers || 0,
        usersByRole: (usersByRoleAgg || []).map((x) => ({ role: x._id || 'user', count: x.count || 0 })),
        userGrowth,
    };

    return sendResponse(res, payload, 'Analytics utilisateurs');
});
