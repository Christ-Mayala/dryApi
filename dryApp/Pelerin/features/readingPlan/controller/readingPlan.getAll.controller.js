const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Plans recuperes', true, pagination || undefined);
});
