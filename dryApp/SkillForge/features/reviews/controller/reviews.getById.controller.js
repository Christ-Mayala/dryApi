const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ReviewsSchema = require('../model/reviews.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Reviews', ReviewsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Reviews introuvable');
  return sendResponse(res, item, 'Reviews recupere');
});
