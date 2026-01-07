const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const sendEmail = require('../../../../../dry/services/email/email.service');

// Envoi d'email depuis l'administration La STREET.
// Objectif : permettre à l'admin de contacter un utilisateur
// sans exposer d'erreur système au frontend.

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

  // Le frontend envoie un sujet + un message texte
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!subject || subject.length < 3) {
    throw new Error('Sujet invalide');
  }

  if (!message || message.length < 3) {
    throw new Error('Message invalide');
  }

  const user = await User.findOne({
    _id: id,
    status: 'active',
    deleted: { $ne: true },
  });

  if (!user) throw new Error('Utilisateur introuvable');
  if (!user.email) throw new Error('Email utilisateur introuvable');

  const ok = await sendEmail({
    email: user.email,
    subject,
    html: `
      <div style="
        font-family: 'Inter', Arial, sans-serif;
        line-height: 1.6;
        color: #111;
        background-color: #ffffff;
      ">
        <p style="margin-bottom:16px;">
          Bonjour,
        </p>

        <p style="margin-bottom:16px;">
          ${escapeHtml(message).replace(/\n/g, '<br/>')}
        </p>

        <p style="margin-top:24px;">
          Cordialement,<br/>
          <strong>L’équipe La STREET</strong>
        </p>

        <hr style="
          border:none;
          border-top:1px solid #eee;
          margin:24px 0;
        " />

        <p style="
          color:#555;
          font-size:12px;
          margin-bottom:6px;
        ">
          Plateforme :
          <a
            href="https://la-street.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            style="color:#000;text-decoration:none;font-weight:600"
          >
            La STREET · Talents & métiers du Congo
          </a>
        </p>

        <p style="
          color:#777;
          font-size:12px;
          margin:0;
        ">
          La STREET est une plateforme conçue et développée par
          <a
            href="https://cyberfusion-group.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style="color:#000;text-decoration:none;font-weight:600"
          >
            CyberFusion Group
          </a>,
          maison de solutions digitales éthiques, durables et humaines.
        </p>
      </div>
    `.trim(),
  });

  if (!ok) {
    throw new Error("Impossible d'envoyer l'email pour le moment");
  }

  return sendResponse(res, { to: user.email }, 'Email envoyé');
});
