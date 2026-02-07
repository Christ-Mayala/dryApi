const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ImpactSchema = require('../model/impact.schema');

const deleteImpact = asyncHandler(async (req, res) => {
    const Impact = req.getModel('Impact', ImpactSchema);
    const impact = await Impact.findById(req.params.id);
    if (!impact) throw new Error('Introuvable');
    
    impact.status = 'deleted';
    impact.deletedAt = new Date();
    await impact.save();
    sendResponse(res, null, 'Action supprimée');
});
module.exports = deleteImpact;