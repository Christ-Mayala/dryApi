const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const emailService = require('../../../../../dry/services/auth/email.service');
const config = require('../../../../../config/database');

const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Admin: envoi en lot (broadcast) vers tous les utilisateurs ou tous les professionnels.
// On ne renvoie pas d'erreurs techniques au frontend (gÃ©rÃ© par errorHandler).

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const audience = String(req.body?.audience || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!['users', 'professionals'].includes(audience)) {
    throw new Error('Audience invalide');
  }

  if (!subject || subject.length < 3) {
    throw new Error('Sujet invalide');
  }

  if (!message || message.length < 3) {
    throw new Error('Message invalide');
  }

  const role = audience === 'professionals' ? 'professional' : 'user';

  const limit = Math.min(parseInt(config.ADMIN_BROADCAST_LIMIT || '200', 10) || 200, 500);

  const recipients = await User.find({
    role,
    status: 'active',
    deleted: { $ne: true },
    email: { $exists: true, $ne: '' },
    includeDeleted: true,
  })
    .select('email name nom')
    .limit(limit)
    .lean();

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const email = String(r?.email || '').trim();
    if (!email) continue;

    attempted += 1;

    const name = r.name || r.nom || 'Client';
    const html = emailService.generateAdminDirectEmailTemplate(message, name, req.appName);

    // eslint-disable-next-line no-await-in-loop
    const ok = await emailService.sendGenericEmail({ email, subject, html });
    if (ok) sent += 1;
    else failed += 1;
  }

  return sendResponse(res, { attempted, sent, failed }, 'Broadcast envoyé');
});

