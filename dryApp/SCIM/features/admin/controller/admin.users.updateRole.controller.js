const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');

    if (!user) return sendResponse(res, null, 'Utilisateur non trouve', false);

    return sendResponse(res, user, 'Role mis a jour avec succes');
});
