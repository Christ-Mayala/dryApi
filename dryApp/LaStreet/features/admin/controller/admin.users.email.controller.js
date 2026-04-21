const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const emailService = require('../../../../../dry/services/auth/email.service');

const escapeHtml = (s) =>
    String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const { id } = req.params;

  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!subject || subject.length < 3) throw new Error('Sujet invalide');
  if (!message || message.length < 3) throw new Error('Message invalide');

  const user = await User.findOne({
    _id: id,
    status: 'active',
    deleted: { $ne: true },
  });

  if (!user) throw new Error('Utilisateur introuvable');
  if (!user.email) throw new Error('Email utilisateur introuvable');

  const ok = await emailService.sendGenericEmail({
    email: user.email,
    subject,
    html: emailService.generateAdminDirectEmailTemplate(message, user.name || user.nom, req.appName),
  });

  if (!ok) throw new Error("Impossible d'envoyer l'email pour le moment");

  return sendResponse(res, { to: user.email }, 'Email envoyé');
});

