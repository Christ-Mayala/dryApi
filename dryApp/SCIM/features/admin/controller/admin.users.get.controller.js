const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé', false);

    return sendResponse(res, user, 'Détails utilisateur');
});
