const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const ImpactSchema = require('../model/impact.schema');

const createImpact = asyncHandler(async (req, res) => {
    const Impact = req.getModel('Impact', ImpactSchema);
    
    let images = [];
    let videos = [];
    
    if (req.files) {
        if (req.files.images) {
            images = req.files.images.map(f => f.path);
        }
        if (req.files.videos) {
            videos = req.files.videos.map(f => f.path);
        }
    }
    
    const impact = await Impact.create({ 
        ...req.body, 
        images,
        videos
    });
    sendResponse(res, impact, 'Action sociale ajoutée');
});
module.exports = createImpact;
