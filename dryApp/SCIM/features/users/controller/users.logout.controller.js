const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { verifyToken, hashToken } = require('../../../../../dry/utils/auth/jwt');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const rt = (req.cookies && req.cookies.rt) || req.body?.refreshToken;

    if (rt) {
        try {
            const decoded = verifyToken(rt);
            const hashedRt = hashToken(rt);
            const user = await User.findById(decoded.id).select('+refreshTokens');
            if (user && Array.isArray(user.refreshTokens)) {
                user.refreshTokens = user.refreshTokens.filter((t) => t !== hashedRt);
                await user.save();
            }
        } catch (_) {}
    }

    res.clearCookie('rt', { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' });
    res.clearCookie('jwt', { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' });
    return sendResponse(res, null, 'Déconnexion réussie.');
});
