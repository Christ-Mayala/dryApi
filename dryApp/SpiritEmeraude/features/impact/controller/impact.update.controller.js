const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const ImpactSchema = require('../model/impact.schema');

const updateImpact = asyncHandler(async (req, res) => {
    const Impact = req.getModel('Impact', ImpactSchema);

    const existing = await Impact.findById(req.params.id);
    if (!existing) throw new Error('Action introuvable');

    const updateData = { ...req.body };

    if (req.files) {
        if (req.files.images) {
            updateData.images = req.files.images.map(f => f.path);
        } else {
            updateData.images = existing.images;
        }

        if (req.files.videos) {
            updateData.videos = req.files.videos.map(f => f.path);
        } else {
            updateData.videos = existing.videos;
        }
    } else {
        updateData.images = existing.images;
        updateData.videos = existing.videos;
    }

    const impact = await Impact.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
    });

    sendResponse(res, impact, 'Action sociale mise à jour');
});

module.exports = updateImpact;
