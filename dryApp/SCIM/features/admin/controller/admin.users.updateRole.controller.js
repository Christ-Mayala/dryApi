const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');

    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé', false);

    return sendResponse(res, user, 'Rôle mis à jour avec succès');
});
