const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// GET ALL - retourne une liste paginee via queryBuilder (filtrable par ?version=, ?bookCode=, ?chapter=)
module.exports = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste recuperee', true, pagination || undefined);
});
