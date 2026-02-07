const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const listProduct = asyncHandler(async (req, res) => {
    // res.advancedResults est rempli par le middleware queryBuilder
    const { data, pagination } = res.advancedResults;
    sendResponse(res, data, 'Liste des produits', true, pagination);
});
module.exports = listProduct;