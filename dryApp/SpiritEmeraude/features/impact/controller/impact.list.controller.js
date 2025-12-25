const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const ImpactSchema = require('../model/impact.schema');

const listImpact = asyncHandler(async (req, res) => {
    const Impact = req.getModel('Impact', ImpactSchema);
    const list = await Impact.find({ status: 'active' }).sort('-date');
    sendResponse(res, list, 'Actions sociales');
});
module.exports = listImpact; 

