const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
    return sendResponse(res, req.body, 'Paramètres mis à jour avec succès');
});
