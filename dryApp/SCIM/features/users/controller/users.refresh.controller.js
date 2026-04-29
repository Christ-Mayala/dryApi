const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { signAccessToken, signRefreshToken, verifyToken, hashToken } = require('../../../../../dry/utils/auth/jwt');

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

    const hashedRt = hashToken(rt);
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(hashedRt)) {
        return sendResponse(res, null, 'Token invalide.', false);
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t !== hashedRt);

    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
    const hashedNewRt = hashToken(newRefreshToken);

    user.refreshTokens.push(hashedNewRt);
    if (user.refreshTokens.length > 10) {
        user.refreshTokens = user.refreshTokens.slice(-10);
    }
    await user.save();

    res.cookie('rt', newRefreshToken, refreshCookieOptions());
    res.cookie('jwt', newAccessToken, accessTokenCookieOptions());
    return sendResponse(res, { token: newAccessToken }, 'Token renouvelé');
});
