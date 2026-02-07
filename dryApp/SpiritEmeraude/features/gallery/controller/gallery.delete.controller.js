const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const GallerySchema = require('../model/gallery.schema');

const deletePhoto = asyncHandler(async (req, res) => {
    const Gallery = req.getModel('Gallery', GallerySchema);
    await Gallery.findByIdAndUpdate(req.params.id, { status: 'deleted', deletedAt: new Date() });
    sendResponse(res, null, 'Photo supprimée');
});
module.exports = deletePhoto;