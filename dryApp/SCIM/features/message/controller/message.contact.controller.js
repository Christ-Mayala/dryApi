const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const MessageSchema = require('../model/message.schema');

const SCIM_EMAIL = process.env.SCIM_CONTACT_EMAIL || 'scim@example.com';

const getScimUserId = async (User) => {
    let user = await User.findOne({ email: SCIM_EMAIL }).select('_id');
    if (!user) user = await User.findOne({ role: 'admin' }).select('_id');
    if (!user) throw new Error('Aucun admin trouvé pour recevoir le message.');
    return user._id;
};

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const contenu = String(req.body?.contenu || '').trim();
    if (!contenu) return sendResponse(res, null, 'Message vide.', false);

    const scimId = await getScimUserId(User);

    const message = await Message.create({
        expediteur: req.user.id,
        destinataire: scimId,
        contenu,
    });

    const populated = await Message.findById(message._id)
        .populate('expediteur', 'name nom email telephone')
        .populate('destinataire', 'name nom email telephone');

    const io = req.app?.get('io');
    if (io) {
        const me = String(req.user.id);
        const other = String(scimId);
        io.to(me).emit('message:new', populated);
        io.to(other).emit('message:new', populated);
    }

    return sendResponse(res, populated, 'Message envoyé à SCIM');
});
