const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const CategoriesSchema = require('../model/categories.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Categories', CategoriesSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Categories introuvable');
  return sendResponse(res, item, 'Categories recupere');
});
