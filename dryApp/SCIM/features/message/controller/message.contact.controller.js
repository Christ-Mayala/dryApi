const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const logger = require('../../../../../dry/utils/logging/logger');

const MessageSchema = require('../model/message.schema');
const config = require('../../../../../config/database');

const {
    normalizePhoneE164,
    sendTwilioMessage,
} = require('../../reservation/controller/reservation.support.util');

const SCIM_EMAIL = config.SCIM_CONTACT_EMAIL || 'scim@example.com';

const getScimUserId = async (User) => {
    let user = await User.findOne({ email: SCIM_EMAIL }).select('_id');
    if (!user) user = await User.findOne({ role: 'admin' }).select('_id');
    if (!user) throw new Error('Aucun admin trouvé pour recevoir le message.');
    return user._id;
};

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const sujet = String(req.body?.sujet || '').trim().slice(0, 200);
    const contenu = String(req.body?.contenu || '').trim();
    if (!contenu) return sendResponse(res, null, 'Message vide.', false);

    const scimId = await getScimUserId(User);

    const message = await Message.create({
        expediteur: req.user.id,
        destinataire: scimId,
        sujet,
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

    // Envoyer notification WhatsApp à l'admin
    try {
        const adminWhatsAppPhone = String(config.SCIM_ADMIN_WHATSAPP_PHONE || config.SCIM_WHATSAPP_PHONE || '').trim();
        const twilioEnabled = Boolean(String(config.SCIM_TWILIO_ACCOUNT_SID || '').trim() && String(config.SCIM_TWILIO_AUTH_TOKEN || '').trim());
        const sendAdminWhatsapp = Boolean(config.SCIM_ENABLE_ADMIN_WHATSAPP_NOTIFICATIONS !== 'false');
        
        if (twilioEnabled && adminWhatsAppPhone && sendAdminWhatsapp) {
            const senderInfo = populated.expediteur;
            const whatsappFrom = String(config.SCIM_TWILIO_WHATSAPP_FROM || '').trim();
            
            const message = `💬 NOUVEAU MESSAGE SCIM\n\n` +
                `📋 Sujet: ${sujet}\n` +
                `👤 De: ${senderInfo?.name || senderInfo?.nom || 'Utilisateur'}\n` +
                `📧 Email: ${senderInfo?.email || ''}\n` +
                `📞 Téléphone: ${senderInfo?.telephone || 'Non renseigné'}\n\n` +
                `💬 Message:\n${contenu}\n\n` +
                `🔗 Veuillez consulter le panel d'administration pour répondre.`;

            await sendTwilioMessage({
                toE164: normalizePhoneE164(adminWhatsAppPhone),
                from: whatsappFrom,
                body: message,
                whatsapp: true,
            });
        }
    } catch (error) {
        logger(`Erreur notification WhatsApp admin pour message: ${error?.message || error}`, 'warning');
    }

    return sendResponse(res, populated, 'Message envoyé à SCIM');
});
