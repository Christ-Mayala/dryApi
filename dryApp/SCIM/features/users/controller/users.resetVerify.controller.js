const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!email || !code) return sendResponse(res, null, 'Email et code requis', false);

    const user = await User.findOne({ email }).select('+resetCode +resetCodeExpires');
    if (!user || !user.resetCode || !user.resetCodeExpires) {
        return sendResponse(res, null, 'Code invalide ou expiré', false);
    }

    if (String(user.resetCode) !== code) return sendResponse(res, null, 'Code invalide', false);
    if (new Date(user.resetCodeExpires).getTime() < Date.now()) return sendResponse(res, null, 'Code expiré', false);

    return sendResponse(res, { email }, 'Code valide');
});
