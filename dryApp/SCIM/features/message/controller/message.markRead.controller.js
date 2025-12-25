const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const msg = await Message.findById(req.params.id);
    if (!msg) return sendResponse(res, null, 'Message introuvable.', false);

    if (msg.destinataire.toString() !== req.user.id.toString()) return sendResponse(res, null, 'Non autorisé.', false);

    msg.lu = true;
    await msg.save();

    return sendResponse(res, null, 'Message marqué comme lu.');
});
