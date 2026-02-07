const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const listAtelier = asyncHandler(async (req, res) => {
    const { data, pagination } = res.advancedResults;
    sendResponse(res, data, 'Liste des ateliers', true, pagination);
});
module.exports = listAtelier;
