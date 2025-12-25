const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { signAccessToken, signRefreshToken } = require('../../../../../dry/utils/jwt');
const { refreshCookieOptions } = require('../../../../../dry/utils/cookies');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const nom = req.body?.nom;
    const name = req.body?.name;
    const email = req.body?.email;
    const telephone = req.body?.telephone;
    const password = req.body?.password;

    const payload = {
        name: name || nom,
        nom: nom || name,
        email,
        telephone,
        password,
        role: req.body?.role,
    };

    if (!payload.name || !payload.email || !payload.password) {
        return sendResponse(res, null, 'name/nom, email et password sont requis.', false);
    }

    const exists = await User.findOne({ email: payload.email });
    if (exists) return sendResponse(res, null, 'Cet email est déjà utilisé', false);

    const user = await User.create(payload);

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
        'Inscription réussie.',
    );
});
