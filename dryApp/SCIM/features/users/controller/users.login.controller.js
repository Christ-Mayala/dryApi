const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { signAccessToken, signRefreshToken } = require('../../../../../dry/utils/auth/jwt');
const { refreshCookieOptions } = require('../../../../../dry/utils/http/cookies');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const identifier = req.body?.identifier || req.body?.email || req.body?.nom || req.body?.name;
    const password = req.body?.password;

    if (!identifier || !password) return sendResponse(res, null, 'identifier/email et password sont requis.', false);

    const user = await User.findOne({
        $or: [{ email: identifier }, { nom: identifier }, { name: identifier }],
    }).select('+password +refreshTokens');

    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé.', false);

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return sendResponse(res, null, 'Mot de passe incorrect.', false);

    const token = signAccessToken(user._id);
    const rt = signRefreshToken(user._id);

    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(rt);
    if (user.refreshTokens.length > 10) {
        user.refreshTokens = user.refreshTokens.slice(-10);
    }
    await user.save();

    res.cookie('rt', rt, refreshCookieOptions());

    return sendResponse(
        res,
        {
            token,
            user: {
                _id: user._id,
                name: user.name,
                nom: user.nom,
                email: user.email,
                telephone: user.telephone,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        },
        'Connexion réussie.',
    );
});
