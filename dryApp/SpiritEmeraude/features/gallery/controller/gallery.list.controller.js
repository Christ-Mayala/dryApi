const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const GallerySchema = require('../model/gallery.schema');

const listGallery = asyncHandler(async (req, res) => {
    const Gallery = req.getModel('Gallery', GallerySchema);
    const photos = await Gallery.find({ status: 'active' }).sort('-createdAt');
    sendResponse(res, photos, 'Galerie Photos');
});
module.exports = listGallery;