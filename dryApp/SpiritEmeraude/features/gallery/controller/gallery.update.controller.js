const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const GallerySchema = require('../model/gallery.schema');

const updatePhoto = asyncHandler(async (req, res) => {
  const Gallery = req.getModel('Gallery', GallerySchema);

  const existing = await Gallery.findById(req.params.id);
  if (!existing) throw new Error('Photo introuvable');

  const update = { ...req.body };

  if (req.file) {
    update.imageUrl = req.file.path;
  } else {
    update.imageUrl = existing.imageUrl;
  }

  const photo = await Gallery.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  sendResponse(res, photo, 'Photo mise à jour');
});

module.exports = updatePhoto;