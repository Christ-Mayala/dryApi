const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const otherId = req.params.userId;
    await Message.updateMany({ destinataire: req.user.id, expediteur: otherId, lu: false }, { $set: { lu: true } });

    const io = req.app?.get('io');
    if (io) {
        const me = String(req.user.id);
        const other = String(otherId);
        io.to(me).emit('thread:read', { userId: other });
        io.to(other).emit('thread:read', { userId: me });
    }

    return sendResponse(res, null, 'Conversation marquée comme lue.');
});
