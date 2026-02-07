const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const GallerySchema = require('../model/gallery.schema');

const createPhoto = asyncHandler(async (req, res) => {
    const Gallery = req.getModel('Gallery', GallerySchema);
    
    if (!req.files || req.files.length === 0) {
        throw new Error('Au moins une image est obligatoire');
    }
    
    const photos = await Promise.all(
        req.files.map(file => 
            Gallery.create({
                ...req.body,
                imageUrl: file.path
            })
        )
    );
    
    sendResponse(res, photos, `${photos.length} photo(s) ajoutée(s)`);
});
module.exports = createPhoto;
