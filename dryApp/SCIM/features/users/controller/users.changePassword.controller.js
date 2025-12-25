const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (req.user.id !== id) return sendResponse(res, null, 'Accès interdit.', false);

    if (!currentPassword || !newPassword) return sendResponse(res, null, 'Champs manquants.', false);

    const user = await User.findById(id).select('+password');
    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé.', false);

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return sendResponse(res, null, 'Mot de passe actuel incorrect.', false);

    user.password = newPassword;
    await user.save();

    return sendResponse(res, null, 'Mot de passe mis à jour.');
});
