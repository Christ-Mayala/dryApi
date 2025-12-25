const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const sendEmail = require('../../../../../dry/services/email/email.service');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return sendResponse(res, null, 'Email requis', false);

    const user = await User.findOne({ email }).select('+resetCode +resetCodeExpires');

    if (!user) return sendResponse(res, null, 'Si un compte existe, un email sera envoyé.', true);

    const code = String(Math.floor(100000 + Math.random() * 900000));

    user.resetCode = code;
    user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const site = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${site}/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Réinitialisation du mot de passe</h2>
          <p>Code: <strong>${code}</strong></p>
          <p>Lien: <a href="${link}">${link}</a></p>
          <p>Ce code expire dans 15 minutes.</p>
        </div>
    `;

    await sendEmail({ email, subject: 'SCIM - Réinitialisation du mot de passe', html });

    return sendResponse(res, { email }, 'Email de réinitialisation envoyé');
});
