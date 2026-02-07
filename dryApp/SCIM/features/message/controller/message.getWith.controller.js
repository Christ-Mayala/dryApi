const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const otherId = req.params.userId;

    if (req.user.role !== 'admin') {
        const other = await User.findById(otherId).select('role');
        if (!other) return sendResponse(res, null, 'Utilisateur introuvable.', false);
        if (other.role !== 'admin') {
            return sendResponse(res, null, 'Conversation non autorisée.', false);
        }
    }
    const { page, limit } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const criteria = {
        $or: [
            { expediteur: req.user.id, destinataire: otherId },
            { expediteur: otherId, destinataire: req.user.id },
        ],
    };

    const total = await Message.countDocuments(criteria);

    const messages = await Message.find(criteria)
        .populate('expediteur', 'name nom email')
        .populate('destinataire', 'name nom email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return sendResponse(res, { page, limit, total, totalPages: Math.ceil(total / limit), messages: messages.reverse() }, 'Conversation');
});
