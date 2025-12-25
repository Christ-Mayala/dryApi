const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
    return sendResponse(res, req.user, 'Profil utilisateur');
});
