const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const StudentsSchema = require('../model/students.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Students', StudentsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Students introuvable');
  return sendResponse(res, item, 'Students recupere');
});
