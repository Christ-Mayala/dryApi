const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const logger = require('../../../../../dry/utils/logging/logger');

const PropertySubmissionSchema = require('../model/propertySubmission.schema');
const MessageSchema = require('../../message/model/message.schema');
const config = require('../../../../../config/database');
const { normalizePhoneE164, sendTwilioMessage } = require('../../reservation/controller/reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const payload = req.body || {};
    const uploadedImages = Array.isArray(req.files?.images) ? req.files.images : [];
    const imageEntries = uploadedImages
        .filter((f) => f?.mimetype?.startsWith('image/') && (f.path || f.secure_url))
        .map((f, idx) => ({
            url: f.path || f.secure_url,
            label: f.originalname || `Image ${idx + 1}`,
        }));

    if (!imageEntries.length) {
        return sendResponse(res, null, 'Au moins une image est requise.', false);
    }
    const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
    if (!admin) return sendResponse(res, null, 'Aucun admin disponible pour traiter la soumission.', false);
    const telephoneNormalized = normalizePhoneE164(payload.telephone) || String(payload.telephone || '').trim();

    const submission = await PropertySubmission.create({
        submitter: {
            user: req.user?._id || undefined,
            nomComplet: payload.nomComplet,
            email: payload.email,
            telephone: telephoneNormalized,
        },
        propertyDraft: {
            titre: payload.titre,
            description: payload.description,
            prix: Number(payload.prix),
            ville: payload.ville,
            adresse: payload.adresse,
            transactionType: payload.transactionType,
            categorie: payload.categorie,
            superficie: payload.superficie ? Number(payload.superficie) : undefined,
            nombre_chambres: payload.nombre_chambres ? Number(payload.nombre_chambres) : 0,
            nombre_salles_bain: payload.nombre_salles_bain ? Number(payload.nombre_salles_bain) : 0,
            nombre_salons: payload.nombre_salons ? Number(payload.nombre_salons) : 0,
            garage: String(payload.garage).toLowerCase() === 'true',
            gardien: String(payload.gardien).toLowerCase() === 'true',
            balcon: String(payload.balcon).toLowerCase() === 'true',
            piscine: String(payload.piscine).toLowerCase() === 'true',
            jardin: String(payload.jardin).toLowerCase() === 'true',
            images: imageEntries,
        },
        source: req.user?._id ? 'authenticated_form' : 'public_form',
    });

    try {
        await Message.create({
            expediteur: admin._id,
            destinataire: admin._id,
            sujet: `Nouvelle soumission bien - ${submission.propertyDraft?.titre || 'Sans titre'}`,
            contenu:
                `Soumission #${submission._id}\n` +
                `Client: ${submission.submitter?.nomComplet}\n` +
                `Email: ${submission.submitter?.email}\n` +
                `Telephone: ${submission.submitter?.telephone}\n` +
                `Ville: ${submission.propertyDraft?.ville}\n` +
                `Transaction: ${submission.propertyDraft?.transactionType}\n` +
                `A valider dans le panel admin.`,
        });
    } catch (_) {}

    try {
        const adminWhatsAppPhone = String(config.SCIM_ADMIN_WHATSAPP_PHONE || config.SCIM_WHATSAPP_PHONE || '').trim();
        const twilioEnabled = Boolean(String(config.SCIM_TWILIO_ACCOUNT_SID || '').trim() && String(config.SCIM_TWILIO_AUTH_TOKEN || '').trim());
        const sendAdminWhatsapp = Boolean(config.SCIM_ENABLE_ADMIN_WHATSAPP_NOTIFICATIONS !== 'false');

        if (twilioEnabled && adminWhatsAppPhone && sendAdminWhatsapp) {
            const body =
                `NOUVELLE SOUMISSION BIEN\n\n` +
                `Client: ${submission.submitter?.nomComplet}\n` +
                `Tel: ${submission.submitter?.telephone}\n` +
                `Titre: ${submission.propertyDraft?.titre}\n` +
                `Ville: ${submission.propertyDraft?.ville}\n` +
                `Prix: ${submission.propertyDraft?.prix}\n` +
                `Ref: ${submission._id}\n\n` +
                `Traitement requis dans le panel admin.`;

            await sendTwilioMessage({
                toE164: normalizePhoneE164(adminWhatsAppPhone),
                from: String(config.SCIM_TWILIO_WHATSAPP_FROM || '').trim(),
                body,
                whatsapp: true,
            });
        }
    } catch (error) {
        logger(`Erreur notification WhatsApp soumission bien: ${error?.message || error}`, 'warning');
    }

    return sendResponse(res, submission, 'Soumission enregistree. L administration va verifier votre bien.');
});
