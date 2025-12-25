const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const FormationSchema = require('../model/formation.schema');

const createFormation = asyncHandler(async (req, res) => {
    const Formation = req.getModel('Formation', FormationSchema);
    let imageUrl = req.file ? req.file.path : null;
    
    const formation = await Formation.create({ ...req.body, image: imageUrl });
    sendResponse(res, formation, 'Formation créée');
});
module.exports = createFormation;