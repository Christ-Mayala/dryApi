const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const CoursesSchema = require('../model/courses.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Courses', CoursesSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Courses introuvable');
  return sendResponse(res, item, 'Courses recupere');
});
