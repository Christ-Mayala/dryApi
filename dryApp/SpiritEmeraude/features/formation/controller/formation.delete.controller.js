const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const FormationSchema = require('../model/formation.schema');

const deleteFormation = asyncHandler(async (req, res) => {
    const Formation = req.getModel('Formation', FormationSchema);
    const formation = await Formation.findById(req.params.id);
    if (!formation) throw new Error('Introuvable');
    
    formation.status = 'deleted';
    formation.deletedAt = new Date();
    await formation.save();
    sendResponse(res, null, 'Formation supprimée');
});
module.exports = deleteFormation;