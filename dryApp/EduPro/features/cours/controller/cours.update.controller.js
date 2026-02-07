const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const CoursSchema = require('../model/cours.schema');

// UPDATE - met a jour un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Cours', CoursSchema);
  const payload = { ...req.body };
  if (req.user?.id) payload.updatedBy = req.user.id;
  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!item) throw new Error('Cours introuvable');
  return sendResponse(res, item, 'Cours mis a jour');
});
