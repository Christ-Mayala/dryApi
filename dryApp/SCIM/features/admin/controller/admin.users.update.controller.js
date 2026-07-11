const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { name, nom, email, telephone, status } = req.body;

    let user;
    try {
        user = await User.findByIdAndUpdate(req.params.id, { name, nom, email, telephone, status }, { new: true, runValidators: true }).select('-password');
    } catch (e) {
        if (e?.code === 11000) {
            const field = Object.keys(e.keyPattern || {})[0];
            if (field === 'telephone') return sendResponse(res, null, 'Ce numéro de téléphone est déjà utilisé', false);
            return sendResponse(res, null, 'Cet email est déjà utilisé', false);
        }
        throw e;
    }

    if (!user) return sendResponse(res, null, 'Utilisateur non trouve', false);

    return sendResponse(res, user, 'Utilisateur mis a jour avec succes');
});
