const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const { page, limit } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const base = { $or: [{ expediteur: req.user.id }, { destinataire: req.user.id }] };

    const allMsgs = await Message.find(base).sort({ createdAt: -1 });

    const threadsMap = new Map();
    allMsgs.forEach((m) => {
        const other = m.expediteur.toString() === req.user.id.toString() ? m.destinataire.toString() : m.expediteur.toString();
        if (!threadsMap.has(other)) threadsMap.set(other, { dernier: m, nonLus: 0 });
        if (!m.lu && m.destinataire.toString() === req.user.id.toString()) threadsMap.get(other).nonLus += 1;
    });

    let threads = Array.from(threadsMap.entries());

    if (req.user.role !== 'admin') {
        const otherIds = threads.map(([id]) => id);
        const admins = await User.find({ _id: { $in: otherIds }, role: 'admin' }).select('_id').lean();
        const adminSet = new Set(admins.map((u) => String(u._id)));
        threads = threads.filter(([id]) => adminSet.has(String(id)));
    }

    const totalThreads = threads.length;
    const totalPages = Math.ceil(totalThreads / limit);

    const start = (page - 1) * limit;
    const paginated = threads.slice(start, start + limit);

    const result = await Promise.all(
        paginated.map(async ([userId, data]) => {
            const user = await User.findById(userId).select('name nom email telephone');
            return { correspondant: user, dernierMessage: data.dernier, nonLus: data.nonLus };
        }),
    );

    return sendResponse(res, { page, limit, totalThreads, totalPages, threads: result }, 'Boîte de réception');
});
