const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const FormationSchema = require('../model/formation.schema');

const getFormation = asyncHandler(async (req, res) => {
    const Formation = req.getModel('Formation', FormationSchema);
    const formation = await Formation.findById(req.params.id);
    if (!formation) throw new Error('Formation introuvable');
    sendResponse(res, formation, 'Détails formation');
});
module.exports = getFormation;