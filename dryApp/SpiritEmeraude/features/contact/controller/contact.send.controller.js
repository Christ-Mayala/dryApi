const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
// Utilise le service email gÃ©nÃ©rique (et non le fichier de templates)
const emailService = require('../../../../../dry/services/auth/email.service');
const ContactSchema = require('../model/contact.schema');
const config = require('../../../../../config/database');

const sendMessage = asyncHandler(async (req, res) => {
    const Contact = req.getModel('Contact', ContactSchema);
    
    // 1. Sauvegarde BD
    const contact = await Contact.create(req.body);

    // 2. Email Admin (optionnel : en cas d'erreur, on log mais on ne bloque pas la rÃ©ponse)
    const html = `
        <h3>Message Site Web</h3>
        <p><strong>De:</strong> ${contact.name} (${contact.phone})</p>
        <p><strong>Sujet:</strong> ${contact.subject || 'Sans sujet'}</p>
        <p>${contact.message}</p>
    `;

    try {
        await emailService.sendGenericEmail({
            email: config.ALERT_EMAIL_TO || config.EMAIL_FROM,
            subject: `[Spirit] ${contact.subject || 'Nouveau message de contact'}`,
            html,
        });
    } catch (e) {
        console.error('Erreur mail', e);
    }

    sendResponse(res, contact, 'Message envoyÃ©');
});
module.exports = sendMessage;

