const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const user = await User.findByIdAndUpdate(req.params.id, { status: 'active', deleted: false, deletedAt: null }, { new: true });
    if (!user) return sendResponse(res, null, 'Utilisateur non trouve', false);

    return sendResponse(res, null, 'Utilisateur restaure avec succes');
});
