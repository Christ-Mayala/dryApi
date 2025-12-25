const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { verifyToken } = require('../../../../../dry/utils/jwt');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const rt = (req.cookies && req.cookies.rt) || req.body?.refreshToken;

    if (rt) {
        try {
            const decoded = verifyToken(rt);
            const user = await User.findById(decoded.id).select('+refreshTokens');
            if (user && Array.isArray(user.refreshTokens)) {
                user.refreshTokens = user.refreshTokens.filter((t) => t !== rt);
                await user.save();
            }
        } catch (_) {}
    }

    res.clearCookie('rt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    return sendResponse(res, null, 'Déconnexion réussie.');
});
