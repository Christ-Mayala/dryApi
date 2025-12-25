const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);

    const msg = await Message.findById(req.params.id);
    if (!msg) return sendResponse(res, null, 'Message introuvable.', false);

    const isParticipant = msg.expediteur.toString() === req.user.id.toString() || msg.destinataire.toString() === req.user.id.toString();
    if (!isParticipant) return sendResponse(res, null, 'Non autorisé.', false);

    const a = String(msg.expediteur);
    const b = String(msg.destinataire);

    await Message.deleteOne({ _id: req.params.id });

    const io = req.app?.get('io');
    if (io) {
        io.to(a).emit('message:deleted', { id: String(req.params.id) });
        io.to(b).emit('message:deleted', { id: String(req.params.id) });
    }

    return sendResponse(res, null, 'Message supprimé.');
});
