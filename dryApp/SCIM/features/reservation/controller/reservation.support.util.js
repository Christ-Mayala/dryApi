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
    if (compact === 'pending' || compact.includes('attente')) return 'en_attente';
    return compact;
};

const reservationStatusLabelMap = {
    en_attente: 'En attente',
    confirmee: 'Confirmee',
    annulee: 'Annulee',
};

const getReservationStatusLabel = (statusKey) => {
    return reservationStatusLabelMap[statusKey] || statusKey || 'En attente';
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

const defaultCountryCode = (() => {
    const raw = String(config.SCIM_DEFAULT_COUNTRY_CODE || '+242').trim();
    const digits = raw.replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '+242';
})();

const normalizeWhatsappPhone = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) return digits.slice(2);
    return digits;
};

const normalizePhoneE164 = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const digits = raw.replace(/[^\d]/g, '');
    if (!digits || digits.length < 8) return '';

    if (raw.startsWith('+')) return `+${digits}`;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;

    const countryDigits = defaultCountryCode.replace(/[^\d]/g, '');
    if (digits.startsWith(countryDigits)) return `+${digits}`;

    const local = digits.replace(/^0+/, '');
    if (!local) return '';
    return `+${countryDigits}${local}`;
};

const isValidContactPhone = (value) => Boolean(normalizePhoneE164(value));

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

const buildReservationContactContent = ({ reservation, propertyTitle, visitDate, stage = 'confirmation' } = {}) => {
    const reference = reservation?.reference || reservation?._id || 'reservation';
    const dateLabel = formatVisitDate(visitDate || reservation?.date);
    const title = propertyTitle || reservation?.property?.titre || 'le bien';

    const baseText = stage === 'reminder'
        ? `Rappel SCIM: merci de confirmer la reservation ${reference} pour "${title}" (${dateLabel}).`
        : `SCIM: votre reservation ${reference} pour "${title}" est confirmee (${dateLabel}).`;

    const ackText = `Repondez OUI ${reference} pour accuser reception.`;

    const subject = stage === 'reminder'
        ? `Rappel reservation ${reference}`
        : `Reservation ${reference} confirmee`;

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>${stage === 'reminder' ? 'Rappel de reservation' : 'Confirmation de reservation'}</h2>
          <p><strong>Reference:</strong> ${reference}</p>
          <p><strong>Bien:</strong> ${title}</p>
          <p><strong>Date de visite:</strong> ${dateLabel}</p>
          <p>${ackText}</p>
          <p>Merci,<br/>Equipe SCIM</p>
        </div>
    `;

    return {
        reference,
        subject,
        smsBody: `${baseText} ${ackText}`,
        whatsappBody: `${baseText}\n${ackText}`,
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

const sendReservationContactNotifications = async ({ reservation, user, propertyTitle, visitDate, stage = 'confirmation' } = {}) => {
    const content = buildReservationContactContent({ reservation, propertyTitle, visitDate, stage });
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
    
    const message = `🏠 NOUVELLE RÉSERVATION SCIM\n\n` +
        `📋 Référence: ${reference}\n` +
        `🏘️ Bien: "${title}"\n` +
        `📅 Date: ${dateLabel}\n` +
        `📞 Téléphone: ${requesterPhone}${whatsappIndicator}\n` +
        `📊 Statut: En attente de confirmation\n\n` +
        `Veuillez traiter cette demande dans le panel d'administration.`;

    const whatsappFrom = String(config.SCIM_TWILIO_WHATSAPP_FROM || '').trim();
    
    return await sendTwilioMessage({
        toE164: normalizePhoneE164(adminWhatsAppPhone),
        from: whatsappFrom,
        body: message,
        whatsapp: true,
    });
};

module.exports = {
    normalizeWhatsappPhone,
    normalizePhoneE164,
    isValidContactPhone,
    normalizeReservationStatusKey,
    getReservationStatusLabel,
    decorateReservationForClient,
    decorateReservationCollectionForClient,
    CONFIRMED_STATUS_VALUES,
    CANCELLED_STATUS_VALUES,
    PENDING_STATUS_VALUES,
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
};
