const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = {};
    if (req.query.status === 'read') query.lu = true;
    else if (req.query.status === 'unread') query.lu = false;

    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        query.$or = [
            { sujet: searchRegex },
            { contenu: searchRegex },
            { 'expediteur.name': searchRegex },
            { 'expediteur.email': searchRegex }
        ];
    }

    const [messages, total] = await Promise.all([
        Message.find(query)
            .populate('expediteur', 'name nom email')
            .populate('destinataire', 'name nom email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip),
        Message.countDocuments(query),
    ]);

    return sendResponse(
        res,
        {
            messages,
            page,
            currentPage: page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        'Liste des messages',
    );
});
