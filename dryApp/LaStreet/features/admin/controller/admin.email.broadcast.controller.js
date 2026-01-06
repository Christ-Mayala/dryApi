const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const sendEmail = require('../../../../../dry/services/email/email.service');

const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Admin: envoi en lot (broadcast) vers tous les utilisateurs ou tous les professionnels.
// On ne renvoie pas d'erreurs techniques au frontend (géré par errorHandler).

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

  const limit = Math.min(parseInt(process.env.ADMIN_BROADCAST_LIMIT || '200', 10) || 200, 500);

  const recipients = await User.find({
    role,
    status: 'active',
    deleted: { $ne: true },
    email: { $exists: true, $ne: '' },
    includeDeleted: true,
  })
    .select('email')
    .limit(limit)
    .lean();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      <p style="color:#666;font-size:12px">Message envoyé depuis l'administration La STREET.</p>
    </div>
  `.trim();

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const email = String(r?.email || '').trim();
    if (!email) continue;

    attempted += 1;

    // eslint-disable-next-line no-await-in-loop
    const ok = await sendEmail({ email, subject, html });
    if (ok) sent += 1;
    else failed += 1;
  }

  return sendResponse(res, { attempted, sent, failed }, 'Broadcast envoyé');
});
