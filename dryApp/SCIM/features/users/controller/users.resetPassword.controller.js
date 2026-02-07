const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !code || !newPassword) return sendResponse(res, null, 'Email, code et nouveau mot de passe requis', false);
    if (newPassword.length < 6) return sendResponse(res, null, 'Mot de passe trop court', false);

    const user = await User.findOne({ email }).select('+resetCode +resetCodeExpires +password');
    if (!user || !user.resetCode || !user.resetCodeExpires) {
        return sendResponse(res, null, 'Code invalide ou expiré', false);
    }

    if (String(user.resetCode) !== code) return sendResponse(res, null, 'Code invalide', false);
    if (new Date(user.resetCodeExpires).getTime() < Date.now()) return sendResponse(res, null, 'Code expiré', false);

    user.password = newPassword;
    user.resetCode = null;
    user.resetCodeExpires = null;
    user.refreshTokens = [];

    await user.save();

    return sendResponse(res, null, 'Mot de passe réinitialisé');
});
