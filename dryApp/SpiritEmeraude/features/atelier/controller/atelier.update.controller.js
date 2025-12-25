const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const AtelierSchema = require('../model/atelier.schema');

const updateAtelier = asyncHandler(async (req, res) => {
    const Atelier = req.getModel('Atelier', AtelierSchema);
    let updateData = { ...req.body };
    
    if (req.files) {
        if (req.files.images) {
            updateData.images = req.files.images.map(file => file.path);
        }
        if (req.files.videos) {
            updateData.videos = req.files.videos.map(file => file.path);
        }
    }

    const atelier = await Atelier.findByIdAndUpdate(req.params.id, updateData, { new: true });
    sendResponse(res, atelier, 'Atelier mis à jour');
});
module.exports = updateAtelier;
