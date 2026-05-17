const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = {};
    if (req.query.role && req.query.role !== 'all') query.role = req.query.role;
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        const searchOr = [
            { name: searchRegex },
            { nom: searchRegex },
            { email: searchRegex },
            { telephone: searchRegex }
        ];

        if (Object.keys(query).length > 0) {
            query.$and = query.$and || [];
            query.$and.push({ $or: searchOr });
        } else {
            query.$or = searchOr;
        }
    }

    const [users, total] = await Promise.all([
        User.find(query).select('-password').sort({ createdAt: -1 }).limit(limit).skip(skip),
        User.countDocuments(query),
    ]);

    return sendResponse(
        res,
        {
            users,
            page,
            currentPage: page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        'Liste des utilisateurs',
    );
});
