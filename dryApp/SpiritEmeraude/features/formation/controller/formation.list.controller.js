const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const listFormation = asyncHandler(async (req, res) => {
    const { data, pagination } = res.advancedResults;
    sendResponse(res, data, 'Liste des formations', true, pagination);
});
module.exports = listFormation;