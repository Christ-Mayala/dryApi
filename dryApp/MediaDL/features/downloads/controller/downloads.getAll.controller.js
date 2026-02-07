const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const DownloadsSchema = require('../model/downloads.schema');

// GET ALL - retourne une liste paginee via queryBuilder
module.exports = asyncHandler(async (req, res) => {
  // res.advancedResults est rempli par le middleware queryBuilder
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste recuperee', true, pagination || undefined);
});
