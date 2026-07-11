const config = require('../../../../../config/database');
const emailService = require('../../../../../dry/services/auth/email.service');
const logger = require('../../../../../dry/utils/logging/logger');

const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const stripDiacritics = (value) => {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const normalizeReservationStatusKey = (value) => {
    const raw = stripDiacritics(value).trim().toLowerCase();
    if (!raw) return 'en_attente';

    const compact = raw.replace(/[\s-]+/g, '_');
    if (compact.startsWith('confirm')) return 'confirmee';
    if (compact.startsWith('annul') || compact.startsWith('cancel')) return 'annulee';
    if (compact.startsWith('termin') || compact.startsWith('complet') || compact === 'done') return 'terminee';
    if (compact === 'pending' || compact.includes('attente')) return 'en_attente';
    return compact;
};

const reservationStatusLabelMap = {
    en_attente: 'En attente',
    confirmee: 'Confirmee',
    annulee: 'Annulee',
    terminee: 'Terminee',
};

const getReservationStatusLabel = (statusKey) => {
    return reservationStatusLabelMap[statusKey] || statusKey || 'En attente';
};

const normalizeRequestTypeKey = (value) => {
    const raw = stripDiacritics(value).trim().toLowerCase();
    if (!raw) return 'visite';
    if (raw.startsWith('loc')) return 'location';
    if (raw.startsWith('ach') || raw.startsWith('vente')) return 'achat';
    return 'visite';
};

const requestTypeLabelMap = {
    visite: 'Visite',
    location: 'Location',
    achat: 'Achat',
};

const requestTypeActionLabelMap = {
    visite: 'demande de visite',
    location: 'demande de location',
    achat: 'demande d’achat',
};

const getRequestTypeLabel = (requestTypeKey) => {
    return requestTypeLabelMap[requestTypeKey] || requestTypeLabelMap.visite;
};

const getRequestTypeActionLabel = (requestTypeKey) => {
    return requestTypeActionLabelMap[requestTypeKey] || requestTypeActionLabelMap.visite;
};

const toPlainObject = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (typeof value.toObject === 'function') {
        return value.toObject({ getters: true });
    }
    return { ...value };
};

const decorateReservationForClient = (reservation) => {
    if (!reservation) return reservation;

    const data = toPlainObject(reservation);
    const statusKey = normalizeReservationStatusKey(data?.status);
    data.status = statusKey;
    data.statusLabel = getReservationStatusLabel(statusKey);

    const requestTypeKey = normalizeRequestTypeKey(data?.requestType);
    data.requestType = requestTypeKey;
    data.requestTypeLabel = getRequestTypeLabel(requestTypeKey);

    if (Array.isArray(data.statusHistory)) {
        data.statusHistory = data.statusHistory.map((entry) => {
            const row = toPlainObject(entry) || {};
            const rowStatusKey = normalizeReservationStatusKey(row.status);
            row.status = rowStatusKey;
            row.statusLabel = getReservationStatusLabel(rowStatusKey);
            return row;
        });
    }

    return data;
};

const decorateReservationCollectionForClient = (reservations) => {
    if (!Array.isArray(reservations)) return [];
    return reservations.map((item) => decorateReservationForClient(item));
};

const CONFIRMED_STATUS_VALUES = ['confirmee', 'confirmed', 'confirm\u00E9e'];
const CANCELLED_STATUS_VALUES = ['annulee', 'cancelled', 'annul\u00E9e'];
const PENDING_STATUS_VALUES = ['en_attente', 'en attente', 'pending'];
const COMPLETED_STATUS_VALUES = ['terminee', 'termin\u00E9e', 'completed', 'done'];

const defaultCountryCode = (() => {
    const raw = String(config.SCIM_DEFAULT_COUNTRY_CODE || '+242').trim();
    const digits = raw.replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '+242';
})();

const normalizePhoneE164 = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const digits = raw.replace(/[^\d]/g, '');
    if (!digits || digits.length < 8) return '';

    if (raw.startsWith('+')) return `+${digits}`;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;

    const countryDigits = defaultCountryCode.replace(/[^\d]/g, '');
    if (digits.startsWith(countryDigits)) {
        // Un "0" de tronc ne doit jamais suivre l'indicatif pays (ex: 242 0 67896752 -> 242 67896752).
        const rest = digits.slice(countryDigits.length).replace(/^0+/, '');
        return rest ? `+${countryDigits}${rest}` : '';
    }

    const local = digits.replace(/^0+/, '');
    if (!local) return '';
    return `+${countryDigits}${local}`;
};

const isValidContactPhone = (value) => Boolean(normalizePhoneE164(value));

// Numero au format wa.me (chiffres uniquement, sans "+"). Contrairement a l'E.164
// "telecom" standard, WhatsApp attend ici le numero congolais avec son "0" initial
// conserve (ex: +242 06 78 96 752, jamais +242 6 78 96 752) : on ne retire donc jamais
// ce zero, on l'ajoute au contraire s'il est absent. Un numero mal forme (indicatif
// manquant, zero absent) affichait "numero inconnu" sur WhatsApp.
const normalizeWhatsappPhone = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);

    const countryDigits = defaultCountryCode.replace(/[^\d]/g, '');
    let local = digits.startsWith(countryDigits) ? digits.slice(countryDigits.length) : digits;

    if (!local.startsWith('0')) local = `0${local}`;

    // Prefixe mobile congolais valide : 0 suivi de 4/5/6/7 puis 7 chiffres (9 chiffres au total).
    if (!/^0[4-7]\d{7}$/.test(local)) return '';

    return `${countryDigits}${local}`;
};

const buildWhatsappUrl = (phone, text = '') => {
    const normalizedPhone = normalizeWhatsappPhone(phone);
    if (!normalizedPhone) return '';
    const payload = String(text || '').trim();
    const query = payload ? `?text=${encodeURIComponent(payload)}` : '';
    return `https://wa.me/${normalizedPhone}${query}`;
};

const parseSlaMinutes = () => {
    const n = Number.parseInt(config.SCIM_RESERVATION_SLA_MINUTES, 10);
    if (Number.isNaN(n)) return 30;
    return Math.min(240, Math.max(5, n));
};

const parseReminderMinutes = () => {
    const n = Number.parseInt(config.SCIM_RESERVATION_REMINDER_MINUTES, 10);
    if (Number.isNaN(n)) return parseSlaMinutes();
    return Math.min(1440, Math.max(5, n));
};

const formatVisitDate = (value) => {
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    } catch (_) {
        return '';
    }
};

const buildReservationReference = ({ createdAt = new Date(), objectId } = {}) => {
    const d = new Date(createdAt);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const tail = String(objectId || '').slice(-5).toUpperCase();
    return `RSV-${y}${m}${day}-${tail || '00000'}`;
};

const buildSupportPayload = ({ reference, propertyTitle, visitDate, requesterPhone, requesterEmail } = {}) => {
    const whatsappPhone = String(config.SCIM_WHATSAPP_PHONE || '').trim();
    const expectedResponseMinutes = parseSlaMinutes();
    const reminderAfterMinutes = parseReminderMinutes();
    const summary = `Reservation ${reference || ''} - ${propertyTitle || 'bien'} - ${formatVisitDate(visitDate)}`.trim();
    const whatsappText = `Bonjour SCIM, je souhaite un suivi pour ${summary}.`;
    const whatsappUrl = buildWhatsappUrl(whatsappPhone, whatsappText);

    return {
        mode: 'web_async',
        reference: reference || '',
        expectedResponseMinutes,
        reminderAfterMinutes,
        whatsappPhone,
        whatsappUrl,
        requesterPhone: String(requesterPhone || '').trim(),
        requesterEmail: String(requesterEmail || '').trim().toLowerCase(),
        confirmedAt: null,
        acknowledgedAt: null,
        reminderSentAt: null,
        reminderAttempts: 0,
        lastContactAt: null,
        lastContactChannel: '',
        asyncNotice: `Demande enregistree. Retour estime sous ${expectedResponseMinutes} min.`,
    };
};

const buildStatusHistoryEntry = ({ status, actorId, note, source = 'web' } = {}) => ({
    status: status || 'en_attente',
    actor: actorId || null,
    note: String(note || '').trim(),
    source,
    at: new Date(),
});

const findAdminContact = async (User) => {
    const contactEmail = String(config.SCIM_CONTACT_EMAIL || 'scim@example.com').trim().toLowerCase();

    let admin = null;
    if (contactEmail) {
        admin = await User.findOne({ email: contactEmail }).select('_id name nom email telephone role');
    }

    if (!admin) {
        admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id name nom email telephone role');
    }

    return admin || null;
};

// Suite concrète de la procédure une fois la réservation confirmée, adaptée au type de demande.
const NEXT_STEPS_BY_TYPE = {
    visite: (dateLabel) => `Merci de vous présenter le ${dateLabel}, muni(e) d'une pièce d'identité valide. Notre agent vous accueillera sur place pour la visite.`,
    location: () => `Notre équipe va vous contacter très prochainement pour finaliser le dossier de location : pièces justificatives, garantie locative et signature du bail.`,
    achat: () => `Notre équipe va vous contacter très prochainement pour la suite du processus d'acquisition : vérification des documents, modalités de financement et signature de l'acte de vente.`,
};

const buildReservationContactContent = ({ reservation, propertyTitle, visitDate, stage = 'confirmation', reason = '' } = {}) => {
    const reference = reservation?.reference || reservation?._id || 'reservation';
    const dateLabel = formatVisitDate(visitDate || reservation?.date);
    const title = propertyTitle || reservation?.property?.titre || 'le bien';
    const requestTypeKey = normalizeRequestTypeKey(reservation?.requestType);
    const actionLabel = getRequestTypeActionLabel(requestTypeKey);
    const nounLabel = requestTypeKey === 'visite' ? 'visite' : getRequestTypeLabel(requestTypeKey).toLowerCase();
    const cleanReason = String(reason || '').trim();

    let subject, baseText, ackText;

    if (stage === 'reminder') {
        subject = `Rappel — Votre ${nounLabel} "${title}" (${reference})`;
        baseText = `Rappel SCIM : votre ${actionLabel} pour "${title}" (réf. ${reference}) est prévue le ${dateLabel}. Merci de confirmer votre présence.`;
        ackText = '';
    } else if (stage === 'cancellation') {
        subject = `Votre ${nounLabel} a été annulée — ${title}`;
        baseText = `Nous vous informons que votre ${actionLabel} (réf. ${reference}) pour "${title}" prévue le ${dateLabel} a été annulée.`;
        baseText += cleanReason ? ` Motif : ${cleanReason}.` : '';
        ackText = `Si vous souhaitez soumettre une nouvelle ${nounLabel} ou avez des questions, n'hésitez pas à nous contacter.`;
    } else if (stage === 'completion') {
        subject = `Merci ! Votre ${nounLabel} est terminée — ${title}`;
        baseText = `Nous vous confirmons que votre ${actionLabel} (réf. ${reference}) pour "${title}" du ${dateLabel} a bien eu lieu et a été clôturée avec succès. Merci pour votre confiance !`;
        ackText = `N'hésitez pas à solliciter à nouveau SCIM Immobilier pour vos futurs projets — ce sera un plaisir de vous accompagner.`;
    } else {
        subject = `✅ ${getRequestTypeLabel(requestTypeKey)} confirmée — ${title} (${reference})`;
        baseText = `Bonne nouvelle ! Votre ${actionLabel} pour "${title}" a été confirmée.`;
        const nextSteps = (NEXT_STEPS_BY_TYPE[requestTypeKey] || NEXT_STEPS_BY_TYPE.visite)(dateLabel);
        ackText = `${nextSteps} Merci de répondre à ce message pour confirmer la bonne réception.`;
    }

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#f4f4f5;border-radius:16px;overflow:hidden">
          <div style="background:${stage === 'cancellation' ? '#27272a' : 'linear-gradient(135deg,#d4af37,#92700a)'};padding:28px;text-align:center">
            <h1 style="margin:0;color:${stage === 'cancellation' ? '#d4af37' : '#09090b'};font-size:22px;font-weight:900">SCIM Immobilier</h1>
            <p style="margin:8px 0 0;color:${stage === 'cancellation' ? '#a1a1aa' : '#09090b'};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.8">
              ${stage === 'cancellation' ? 'Visite annulée' : stage === 'reminder' ? 'Rappel de visite' : stage === 'completion' ? 'Demande terminée' : 'Visite confirmée'}
            </p>
          </div>
          <div style="padding:28px">
            <p style="font-size:15px;color:#a1a1aa;line-height:1.7">${baseText}</p>
            ${ackText ? `<p style="font-size:14px;color:#a1a1aa;line-height:1.7">${ackText}</p>` : ''}
            <div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:18px;margin:20px 0">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:7px 0;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:110px">Référence</td><td style="color:#fff;font-weight:700">${reference}</td></tr>
                <tr><td style="padding:7px 0;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Bien</td><td style="color:#fff">${title}</td></tr>
                <tr><td style="padding:7px 0;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Date</td><td style="color:#d4af37;font-weight:700">${dateLabel}</td></tr>
              </table>
            </div>
            <p style="font-size:13px;color:#71717a;margin-top:24px">L'équipe SCIM Immobilier<br/><span style="color:#52525b">Congo-Brazzaville</span></p>
          </div>
          <div style="background:#18181b;padding:14px;text-align:center">
            <p style="margin:0;color:#52525b;font-size:11px">© ${new Date().getFullYear()} SCIM Immobilier</p>
          </div>
        </div>
    `;

    const smsBaseText = stage === 'cancellation'
        ? `SCIM: Votre ${nounLabel} (réf. ${reference}) pour "${title}" le ${dateLabel} a été annulée.${cleanReason ? ` Motif : ${cleanReason}.` : ''} Contactez-nous pour en planifier une nouvelle.`
        : stage === 'reminder'
        ? `Rappel SCIM: ${nounLabel} pour "${title}" le ${dateLabel} (réf. ${reference}). Confirmez votre présence.`
        : stage === 'completion'
        ? `SCIM: Votre ${nounLabel} (réf. ${reference}) pour "${title}" est marquée terminée. Merci pour votre confiance.`
        : `SCIM: ${getRequestTypeLabel(requestTypeKey)} confirmée pour "${title}" le ${dateLabel} (réf. ${reference}). Merci de confirmer réception.`;

    return {
        reference,
        subject,
        smsBody: smsBaseText,
        whatsappBody: smsBaseText,
        emailHtml: html,
    };
};

const hasTwilioConfig = () => {
    return Boolean(String(config.SCIM_TWILIO_ACCOUNT_SID || '').trim() && String(config.SCIM_TWILIO_AUTH_TOKEN || '').trim());
};

const sendTwilioMessage = async ({ toE164, from, body, whatsapp = false } = {}) => {
    const accountSid = String(config.SCIM_TWILIO_ACCOUNT_SID || '').trim();
    const authToken = String(config.SCIM_TWILIO_AUTH_TOKEN || '').trim();

    if (!accountSid || !authToken) return { sent: false, reason: 'twilio_not_configured' };
    if (!toE164 || !from || !body) return { sent: false, reason: 'missing_payload' };

    const to = whatsapp ? (String(toE164).startsWith('whatsapp:') ? String(toE164) : `whatsapp:${toE164}`) : String(toE164);
    const fromValue = whatsapp ? (String(from).startsWith('whatsapp:') ? String(from) : `whatsapp:${from}`) : String(from);

    try {
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const payload = new URLSearchParams();
        payload.set('To', to);
        payload.set('From', fromValue);
        payload.set('Body', String(body));

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: payload.toString(),
        });

        const raw = await response.text();
        if (!response.ok) {
            return { sent: false, reason: `twilio_http_${response.status}`, detail: raw.slice(0, 500) };
        }

        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch (_) {}

        return { sent: true, sid: parsed?.sid || '', channel: whatsapp ? 'whatsapp' : 'sms' };
    } catch (error) {
        return { sent: false, reason: 'twilio_error', detail: error?.message || String(error) };
    }
};

const sendReservationContactNotifications = async ({ reservation, user, propertyTitle, visitDate, stage = 'confirmation', reason = '' } = {}) => {
    const content = buildReservationContactContent({ reservation, propertyTitle, visitDate, stage, reason });
    const normalizedPhone = normalizePhoneE164(user?.telephone || reservation?.support?.requesterPhone || '');
    const destinationEmail = String(user?.email || reservation?.support?.requesterEmail || '').trim().toLowerCase();

    const result = {
        stage,
        email: { sent: false, reason: 'not_attempted' },
        sms: { sent: false, reason: 'not_attempted' },
        whatsapp: { sent: false, reason: 'not_attempted' },
        primaryChannel: '',
    };

    const sendEmail = parseBool(config.SCIM_ENABLE_EMAIL_NOTIFICATIONS, true);

    if (!sendEmail) {
        result.email = { sent: false, reason: 'email_disabled' };
    } else if (destinationEmail) {
        try {
            await emailService.sendGenericEmail({
                email: destinationEmail,
                subject: content.subject,
                html: content.emailHtml,
            });
            result.email = { sent: true };
            result.primaryChannel = 'email';
        } catch (error) {
            result.email = { sent: false, reason: error?.message || 'email_send_error' };
        }
    } else {
        result.email = { sent: false, reason: 'missing_email' };
    }

    const twilioEnabled = hasTwilioConfig();
    const sendSms = parseBool(config.SCIM_ENABLE_SMS_NOTIFICATIONS, true);
    const sendWhatsapp = parseBool(config.SCIM_ENABLE_WHATSAPP_NOTIFICATIONS, true);

    if (twilioEnabled && normalizedPhone && sendSms) {
        const smsFrom = String(config.SCIM_TWILIO_SMS_FROM || '').trim();
        result.sms = await sendTwilioMessage({
            toE164: normalizedPhone,
            from: smsFrom,
            body: content.smsBody,
            whatsapp: false,
        });
        if (!result.primaryChannel && result.sms.sent) result.primaryChannel = 'sms';
    } else if (!twilioEnabled) {
        result.sms = { sent: false, reason: 'twilio_not_configured' };
    } else if (!normalizedPhone) {
        result.sms = { sent: false, reason: 'missing_phone' };
    } else if (!sendSms) {
        result.sms = { sent: false, reason: 'sms_disabled' };
    }

    if (twilioEnabled && normalizedPhone && sendWhatsapp) {
        const whatsappFrom = String(config.SCIM_TWILIO_WHATSAPP_FROM || '').trim();
        result.whatsapp = await sendTwilioMessage({
            toE164: normalizedPhone,
            from: whatsappFrom,
            body: content.whatsappBody,
            whatsapp: true,
        });
        if (!result.primaryChannel && result.whatsapp.sent) result.primaryChannel = 'whatsapp';
    } else if (!twilioEnabled) {
        result.whatsapp = { sent: false, reason: 'twilio_not_configured' };
    } else if (!normalizedPhone) {
        result.whatsapp = { sent: false, reason: 'missing_phone' };
    } else if (!sendWhatsapp) {
        result.whatsapp = { sent: false, reason: 'whatsapp_disabled' };
    }

    if (!result.primaryChannel) {
        result.primaryChannel = result.email.sent ? 'email' : '';
    }

    if (!result.email.sent && !result.sms.sent && !result.whatsapp.sent) {
        logger(`Reservation notification non envoyee (${content.reference})`, 'warning');
    }

    return result;
};

const sendAdminWhatsAppNotification = async ({ reservation, propertyTitle, requesterPhone, isWhatsapp } = {}) => {
    const adminWhatsAppPhone = String(config.SCIM_ADMIN_WHATSAPP_PHONE || config.SCIM_WHATSAPP_PHONE || '').trim();
    const twilioEnabled = hasTwilioConfig();
    const sendAdminWhatsapp = parseBool(config.SCIM_ENABLE_ADMIN_WHATSAPP_NOTIFICATIONS, true);
    
    if (!twilioEnabled || !adminWhatsAppPhone || !sendAdminWhatsapp) {
        return { sent: false, reason: 'admin_whatsapp_disabled_or_not_configured' };
    }

    const reference = reservation?.reference || reservation?._id || 'reservation';
    const dateLabel = formatVisitDate(reservation?.date);
    const title = propertyTitle || reservation?.property?.titre || 'le bien';
    const whatsappIndicator = isWhatsapp ? ' (WhatsApp)' : ' (SMS)';
    const propertyId = reservation?.propertyId || reservation?.property?._id || 'N/A';
    const propertyUrl = `${config.FRONTEND_URL || 'https://scim.netlify.app'}/properties/${propertyId}`;
    
    const message = `🏠 NOUVELLE RÉSERVATION SCIM\n\n` +
        `📋 Référence: ${reference}\n` +
        `🆔 ID Bien: ${propertyId}\n` +
        `🏘️ Bien: "${title}"\n` +
        `📅 Date: ${dateLabel}\n` +
        `📞 Téléphone: ${requesterPhone}${whatsappIndicator}\n` +
        `📊 Statut: En attente de confirmation\n\n` +
        `🔗 Lien du bien: ${propertyUrl}\n\n` +
        `Veuillez traiter cette demande dans le panel d'administration.`;

    const whatsappFrom = String(config.SCIM_TWILIO_WHATSAPP_FROM || '').trim();
    
    return await sendTwilioMessage({
        toE164: normalizePhoneE164(adminWhatsAppPhone),
        from: whatsappFrom,
        body: message,
        whatsapp: true,
    });
};

// Pousse le message créé en temps réel via Socket.io (même mécanisme que la messagerie
// classique — voir message.send.controller.js) afin que l'expéditeur ET le destinataire
// voient leur badge/inbox se mettre à jour instantanément, sans devoir rafraîchir.
const notifyNewMessage = async (req, Message, message) => {
    try {
        if (!message?._id) return;
        const populated = await Message.findById(message._id)
            .populate('expediteur', 'name nom email telephone')
            .populate('destinataire', 'name nom email telephone');
        if (!populated) return;

        const io = req.app?.get('io');
        if (!io) return;

        const from = String(populated.expediteur?._id || populated.expediteur || '');
        const to = String(populated.destinataire?._id || populated.destinataire || '');
        if (from) io.to(from).emit('message:new', populated);
        if (to) io.to(to).emit('message:new', populated);
    } catch (_) {}
};

module.exports = {
    normalizeWhatsappPhone,
    normalizePhoneE164,
    isValidContactPhone,
    normalizeReservationStatusKey,
    getReservationStatusLabel,
    normalizeRequestTypeKey,
    getRequestTypeLabel,
    getRequestTypeActionLabel,
    decorateReservationForClient,
    decorateReservationCollectionForClient,
    CONFIRMED_STATUS_VALUES,
    CANCELLED_STATUS_VALUES,
    PENDING_STATUS_VALUES,
    COMPLETED_STATUS_VALUES,
    buildWhatsappUrl,
    buildReservationReference,
    buildSupportPayload,
    buildStatusHistoryEntry,
    findAdminContact,
    parseSlaMinutes,
    parseReminderMinutes,
    formatVisitDate,
    sendReservationContactNotifications,
    sendAdminWhatsAppNotification,
    notifyNewMessage,
};
