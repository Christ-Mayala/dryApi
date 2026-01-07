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

  const ok = await sendEmail({
    email: user.email,
    subject,
    html: `
      <div style="
        font-family: 'Inter', Arial, sans-serif;
        line-height: 1.6;
        color: #111;
        background-color: #ffffff;
        padding: 24px;
      ">
        <p style="margin-bottom:16px; font-size:16px;">
          Bonjour,
        </p>

        <p style="margin-bottom:24px; font-size:15px;">
          ${escapeHtml(message).replace(/\n/g, '<br/>')}
        </p>

        <p style="margin-bottom:24px; font-size:15px;">
          Cordialement,<br/>
          <strong>L’équipe La STREET</strong>
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />

        <!-- Boutons -->
        <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
          <a href="https://la-street.netlify.app/"
             target="_blank"
             rel="noopener noreferrer"
             style="
               padding:12px 20px;
               background-color:#f5c518;
               color:#000;
               text-decoration:none;
               font-weight:600;
               border-radius:8px;
               display:inline-block;
               text-align:center;
               min-width:180px;
             ">
            Visiter La STREET
          </a>

          <a href="https://cyberfusion-group.vercel.app/"
             target="_blank"
             rel="noopener noreferrer"
             style="
               padding:12px 20px;
               background-color:#0a58ca;
               color:#fff;
               text-decoration:none;
               font-weight:600;
               border-radius:8px;
               display:inline-block;
               text-align:center;
               min-width:180px;
             ">
            CyberFusion Group
          </a>
        </div>

        <p style="color:#555; font-size:12px; margin:0;">
          Cet email a été envoyé depuis l’administration officielle de
          <strong>La STREET · Talents & métiers du Congo</strong>.
        </p>

        <p style="color:#777; font-size:12px; margin-top:4px;">
          La STREET est conçue et développée par
          <strong>CyberFusion Group</strong>, maison de solutions digitales éthiques, durables et humaines.
        </p>
      </div>
    `.trim(),
  });

  if (!ok) throw new Error("Impossible d'envoyer l'email pour le moment");

  return sendResponse(res, { to: user.email }, 'Email envoyé');
});
