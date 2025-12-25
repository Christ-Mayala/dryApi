const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const AtelierSchema = require('../model/atelier.schema');

const createAtelier = asyncHandler(async (req, res) => {
    const Atelier = req.getModel('Atelier', AtelierSchema);
    
    let images = [];
    let videos = [];
    
    if (req.files) {
        if (req.files.images) {
            images = req.files.images.map(file => file.path);
        }
        if (req.files.videos) {
            videos = req.files.videos.map(file => file.path);
        }
    }
    
    const atelier = await Atelier.create({ 
        ...req.body, 
        images,
        videos
    });
    sendResponse(res, atelier, 'Atelier créé');
});
module.exports = createAtelier;
