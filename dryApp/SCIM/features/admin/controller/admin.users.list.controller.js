const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { getPagination } = require('../../../../../dry/utils/pagination');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.search) {
        query.$or = [
            { name: { $regex: req.query.search, $options: 'i' } },
            { nom: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
        ];
    }

    const [users, total] = await Promise.all([
        User.find(query).select('-password').sort({ createdAt: -1 }).limit(limit).skip(skip),
        User.countDocuments(query),
    ]);

    return sendResponse(res, { users, totalPages: Math.ceil(total / limit), currentPage: page, total }, 'Liste des utilisateurs');
});
