const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { signAccessToken, signRefreshToken, verifyToken } = require('../../../../../dry/utils/jwt');
const { refreshCookieOptions } = require('../../../../../dry/utils/cookies');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const rt = req.cookies?.rt;
    if (!rt) return sendResponse(res, null, 'Refresh token requis', false);

    let decoded;
    try {
        decoded = verifyToken(rt);
    } catch (_) {
        return sendResponse(res, null, 'Token expiré ou invalide.', false);
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(rt)) {
        return sendResponse(res, null, 'Token invalide.', false);
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t !== rt);

    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);

    user.refreshTokens.push(newRefreshToken);
    if (user.refreshTokens.length > 10) {
        user.refreshTokens = user.refreshTokens.slice(-10);
    }
    await user.save();

    res.cookie('rt', newRefreshToken, refreshCookieOptions());
    return sendResponse(res, { token: newAccessToken }, 'Token renouvelé');
});
