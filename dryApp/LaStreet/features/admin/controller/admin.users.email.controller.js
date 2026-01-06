const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const sendEmail = require('../../../../../dry/services/email/email.service');

// Envoi d'email depuis l'administration LaStreet.
// Objectif: permettre à l'admin de contacter un utilisateur sans exposer d'erreur système au frontend.

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

  // Le frontend envoie un sujet + un message texte.
  // On construit un HTML minimal (texte échappé) pour éviter tout contenu dangereux.
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!subject || subject.length < 3) {
    throw new Error('Sujet invalide');
  }

  if (!message || message.length < 3) {
    throw new Error('Message invalide');
  }

  const user = await User.findOne({ _id: id, status: 'active', deleted: { $ne: true } });
  if (!user) throw new Error('Utilisateur introuvable');

  if (!user.email) throw new Error('Email utilisateur introuvable');

  const ok = await sendEmail({
    email: user.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        <p style="color:#666;font-size:12px">Message envoyé depuis l'administration La STREET.</p>
      </div>
    `.trim(),
  });

  if (!ok) {
    throw new Error("Impossible d'envoyer l'email pour le moment");
  }

  return sendResponse(res, { to: user.email }, 'Email envoyé');
});
