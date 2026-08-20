/**
 * Service de messagerie — Trivida Admin Panel
 * 
 * Envoie des messages aux utilisateurs via :
 *   - Email (via Brevo API ou SMTP)
 *   - WhatsApp (via CallMeBot API gratuite)
 * 
 * Utilisé pour relancer les abonnés, envoyer des notifications, etc.
 */
const axios = require('axios');
const emailService = require('../../../../../dry/services/auth/email.service');

/**
 * Envoyer un email via le service email existant (Brevo/SMTP)
 * @param {Object} params
 * @param {string} params.to - Adresse email du destinataire
 * @param {string} params.subject - Sujet
 * @param {string} params.html - Contenu HTML
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendEmail({ to, subject, html }) {
    try {
        await emailService.sendGenericEmail({
            email: to,
            subject,
            html,
        });
        return { success: true, channel: 'email', to };
    } catch (error) {
        console.error('[Messaging] Erreur envoi email:', error.message);
        return { success: false, channel: 'email', to, error: error.message };
    }
}

/**
 * Envoyer un message WhatsApp via CallMeBot API
 * @param {Object} params
 * @param {string} params.phone - Numéro de téléphone (format +242...)
 * @param {string} params.message - Message texte
 * @param {string} params.apiKey - Clé API CallMeBot
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendWhatsApp({ phone, message, apiKey }) {
    if (!apiKey) {
        return { success: false, channel: 'whatsapp', phone, error: 'Clé API WhatsApp non configurée' };
    }
    
    if (!phone) {
        return { success: false, channel: 'whatsapp', phone, error: 'Numéro de téléphone manquant' };
    }
    
    try {
        // CallMeBot API : GET https://api.callmebot.com/whatsapp.php?phone=...&text=...&apikey=...
        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;
        
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data && response.data.includes('success')) {
            return { success: true, channel: 'whatsapp', phone };
        }
        
        return { success: false, channel: 'whatsapp', phone, error: response.data || 'Réponse inconnue' };
    } catch (error) {
        console.error('[Messaging] Erreur WhatsApp:', error.message);
        return { success: false, channel: 'whatsapp', phone, error: error.message };
    }
}

/**
 * Remplacer les variables dans un template de message
 * @param {string} template - Template avec {variables}
 * @param {Object} vars - Variables à remplacer
 * @returns {string} Template avec les valeurs
 */
function renderTemplate(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return result;
}

/**
 * Envoyer un SMS via une SIM physique (gateway Android local)
 * 
 * Principe : l'admin installe une app SMS Gateway sur son téléphone Android.
 * L'app expose une API HTTP locale sur le réseau (ex: http://192.168.1.100:8080).
 * Le backend envoie les SMS via cette API — le message part du vrai numéro de SIM.
 * 
 * Apps recommandées (gratuites) :
 *   - "SMS Gateway" by onemarcfifty (F-Droid)
 *   - "SMS Gateway API" (Play Store)
 * 
 * @param {Object} params
 * @param {string} params.to - Numéro de téléphone (format international)
 * @param {string} params.message - Texte du SMS
 * @param {Object} params.smsConfig - { gatewayUrl, senderNumber }
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendSMS({ to, message, smsConfig }) {
    if (!to) {
        return { success: false, channel: 'sms', to, error: 'Numéro de téléphone manquant' };
    }
    
    // ── Mode 1 : Gateway Android local (SIM physique) ──
    if (smsConfig?.gatewayUrl) {
        try {
            const gatewayUrl = smsConfig.gatewayUrl.replace(/\/$/, '');
            const response = await axios.post(`${gatewayUrl}/send`, {
                phone: to,
                message: message,
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
            });
            
            if (response.data?.success || response.status === 200) {
                console.log(`[SMS] ✅ Envoyé via SIM physique à ${to}`);
                return { success: true, channel: 'sms', to, method: 'sim_gateway' };
            }
            return { success: false, channel: 'sms', to, error: response.data?.error || 'Échec envoi SMS' };
        } catch (error) {
            console.error('[SMS] Erreur gateway local:', error.message);
            return { success: false, channel: 'sms', to, error: `Gateway inaccessible: ${error.message}` };
        }
    }
    
    // ── Mode 2 : Provider cloud (fallback) ──
    if (smsConfig?.apiKey) {
        const provider = smsConfig.provider || 'africastalking';
        
        try {
            if (provider === 'africastalking') {
                const url = 'https://api.africastalking.com/version1/messaging';
                const response = await axios.post(url, {
                    username: smsConfig.username || 'sandbox',
                    to: [to],
                    message: message,
                    from: smsConfig.senderNumber || '',
                }, {
                    headers: { 'apiKey': smsConfig.apiKey, 'Content-Type': 'application/json' },
                    timeout: 10000,
                });
                
                if (response.data?.SMSMessageData?.recipients?.[0]?.status === 'Success') {
                    return { success: true, channel: 'sms', to, method: 'africastalking' };
                }
                return { success: false, channel: 'sms', to, error: response.data?.SMSMessageData?.Message || 'Échec' };
            }
            
            if (provider === 'twilio') {
                const url = `https://api.twilio.com/2010-04-01/Accounts/${smsConfig.accountSid}/Messages.json`;
                const response = await axios.post(url,
                    new URLSearchParams({ To: to, From: smsConfig.senderNumber, Body: message }).toString(),
                    { auth: { username: smsConfig.accountSid, password: smsConfig.apiKey }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
                );
                if (response.data?.sid) return { success: true, channel: 'sms', to, method: 'twilio' };
                return { success: false, channel: 'sms', to, error: response.data?.message || 'Échec' };
            }
            
            if (provider === 'termii') {
                const url = 'https://api.termii.com/api/sms/send';
                const response = await axios.post(url, {
                    api_key: smsConfig.apiKey, type: 'plain', to, from: smsConfig.senderNumber || 'Trivida', channel: 'generic', msg: message,
                }, { timeout: 10000 });
                if (response.data?.code === 'ok') return { success: true, channel: 'sms', to, method: 'termii' };
                return { success: false, channel: 'sms', to, error: response.data?.message || 'Échec' };
            }
        } catch (error) {
            console.error(`[SMS] Erreur ${provider}:`, error.message);
            return { success: false, channel: 'sms', to, error: error.message };
        }
    }
    
    // ── Mode 3 : Aucun gateway configuré ──
    console.log(`[SMS] ⚠️ Pas de gateway configuré — envoi simulé à ${to}`);
    return { success: true, channel: 'sms', to, simulated: true };
}

/**
 * Envoyer un message en lot (email +/ou WhatsApp +/ou SMS)
 * @param {Object} params
 * @param {Array} params.users - Liste d'utilisateurs [{name, email, telephone}]
 * @param {string} params.subject - Sujet email
 * @param {string} params.message - Corps du message
 * @param {string} params.channel - 'email' | 'whatsapp' | 'sms' | 'both'
 * @param {Object} params.whatsappConfig - { enabled, apiKey }
 * @param {Object} params.smsConfig - { provider, apiKey, senderNumber }
 * @returns {Promise<Object>} Résultats
 */
async function sendBulkMessage({ users, subject, message, channel, whatsappConfig, smsConfig }) {
    const results = {
        total: users.length,
        email: { sent: 0, failed: 0, errors: [] },
        whatsapp: { sent: 0, failed: 0, errors: [] },
        sms: { sent: 0, failed: 0, errors: [] },
    };
    
    for (const user of users) {
        // Email
        if (channel === 'email' || channel === 'both' || channel === 'email_sms') {
            if (user.email) {
                const result = await sendEmail({
                    to: user.email,
                    subject,
                    html: message.replace(/\n/g, '<br>'),
                });
                if (result.success) {
                    results.email.sent++;
                } else {
                    results.email.failed++;
                    results.email.errors.push({ email: user.email, error: result.error });
                }
            }
        }
        
        // WhatsApp
        if ((channel === 'whatsapp' || channel === 'both') && whatsappConfig?.enabled) {
            if (user.telephone) {
                const result = await sendWhatsApp({
                    phone: user.telephone,
                    message,
                    apiKey: whatsappConfig.apiKey,
                });
                if (result.success) {
                    results.whatsapp.sent++;
                } else {
                    results.whatsapp.failed++;
                    results.whatsapp.errors.push({ phone: user.telephone, error: result.error });
                }
            }
        }
        
        // SMS
        if ((channel === 'sms' || channel === 'email_sms') && smsConfig?.enabled) {
            if (user.telephone) {
                const result = await sendSMS({
                    to: user.telephone,
                    message,
                    smsConfig,
                });
                if (result.success) {
                    results.sms.sent++;
                } else {
                    results.sms.failed++;
                    results.sms.errors.push({ phone: user.telephone, error: result.error });
                }
            }
        }
        
        // Petit délai entre les envois (rate limit)
        await new Promise(r => setTimeout(r, 200));
    }
    
    return results;
}

module.exports = { sendEmail, sendWhatsApp, sendSMS, renderTemplate, sendBulkMessage };
