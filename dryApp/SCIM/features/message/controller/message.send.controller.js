const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const receiverId = req.params.receiverId;
    const sujet = String(req.body?.sujet || '').trim().slice(0, 200);
    const contenu = String(req.body?.contenu || '').trim();
    if (!contenu) return sendResponse(res, null, 'Message vide.', false);

    const dest = await User.findById(receiverId).select('role');
    if (!dest) return sendResponse(res, null, 'Destinataire introuvable.', false);

    const isAdminSender = req.user.role === 'admin';
    const isAdminDest = dest.role === 'admin';

    if (!isAdminSender && !isAdminDest) {
        return sendResponse(res, null, 'Vous ne pouvez contacter que l\'agence (admin).', false);
    }

    const message = await Message.create({
        expediteur: req.user.id,
        destinataire: receiverId,
        sujet,
        contenu,
    });

    const populated = await Message.findById(message._id)
        .populate('expediteur', 'name nom email telephone')
        .populate('destinataire', 'name nom email telephone');

    const io = req.app?.get('io');
    if (io) {
        const me = String(req.user.id);
        const other = String(receiverId);
        io.to(me).emit('message:new', populated);
        io.to(other).emit('message:new', populated);
    }

    return sendResponse(res, populated, 'Message envoyé');
});
