const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { signAccessToken, signRefreshToken } = require('../../../../../dry/utils/auth/jwt');
const { refreshCookieOptions } = require('../../../../../dry/utils/http/cookies');
const { isValidContactPhone, normalizePhoneE164 } = require('../../reservation/controller/reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const nom = req.body?.nom;
    const name = req.body?.name;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const telephoneRaw = String(req.body?.telephone || '').trim();
    const telephone = normalizePhoneE164(telephoneRaw);
    const password = req.body?.password;

    const payload = {
        name: name || nom,
        nom: nom || name,
        email,
        telephone,
        password,
        role: req.body?.role,
    };

    if (!payload.name || !payload.email || !payload.password || !telephoneRaw) {
        return sendResponse(res, null, 'name/nom, email, telephone et password sont requis.', false);
    }

    if (!isValidContactPhone(telephoneRaw)) {
        return sendResponse(res, null, 'Numero de telephone invalide.', false);
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
