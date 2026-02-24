const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const lu = !!req.body?.lu;
    const message = await Message.findByIdAndUpdate(req.params.id, { lu }, { new: true });

    if (!message) return sendResponse(res, null, 'Message non trouve', false);

    return sendResponse(res, message, 'Statut mis a jour avec succes');
});
