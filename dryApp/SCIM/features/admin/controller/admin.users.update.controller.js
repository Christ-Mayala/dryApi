const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { name, nom, email, telephone, status } = req.body;

    const user = await User.findByIdAndUpdate(req.params.id, { name, nom, email, telephone, status }, { new: true }).select('-password');

    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé', false);

    return sendResponse(res, user, 'Utilisateur mis à jour avec succès');
});
