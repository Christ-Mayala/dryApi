const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const message = await Message.findById(req.params.id)
        .populate('expediteur', 'name nom email telephone')
        .populate('destinataire', 'name nom email telephone');

    if (!message) return sendResponse(res, null, 'Message non trouve', false);

    return sendResponse(res, message, 'Details message');
});
