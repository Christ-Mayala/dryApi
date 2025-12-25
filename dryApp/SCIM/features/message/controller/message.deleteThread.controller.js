const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const otherId = req.params.userId;

    const criteria = {
        $or: [
            { expediteur: req.user.id, destinataire: otherId },
            { expediteur: otherId, destinataire: req.user.id },
        ],
    };

    const result = await Message.deleteMany(criteria);

    const io = req.app?.get('io');
    if (io) {
        const me = String(req.user.id);
        const other = String(otherId);
        io.to(me).emit('thread:deleted', { userId: other });
        io.to(other).emit('thread:deleted', { userId: me });
    }

    return sendResponse(res, { deleted: result.deletedCount }, 'Conversation supprimée.');
});
