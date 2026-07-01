const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const FormationSchema = require('../model/formation.schema');

const updateFormation = asyncHandler(async (req, res) => {
    const Formation = req.getModel('Formation', FormationSchema);
    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.path;

    const formation = await Formation.findByIdAndUpdate(req.params.id, updateData, { new: true });
    sendResponse(res, formation, 'Formation mise à jour');
});
module.exports = updateFormation;