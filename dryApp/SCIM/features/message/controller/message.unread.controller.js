const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const unread = await Message.countDocuments({ destinataire: req.user.id, lu: false });
    return sendResponse(res, { unread }, 'Messages non lus');
});
