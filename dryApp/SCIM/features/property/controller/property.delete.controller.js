const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(req.params.id);
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
        return sendResponse(res, null, 'Non autorisé.', false);
    }

    for (const img of property.images || []) {
        if (img.public_id) {
            try {
                await cloudinary.uploader.destroy(img.public_id);
            } catch (_) {}
        }
    }

    property.isDeleted = true;
    property.deletedAt = new Date();
    property.status = 'deleted';
    await property.save();

    return sendResponse(res, null, 'Bien supprimé.');
});
