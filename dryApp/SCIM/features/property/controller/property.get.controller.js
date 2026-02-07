const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getClientIp, hashIp } = require('../../../../../dry/utils/http/ip');

const PropertySchema = require('../model/property.schema');
const PropertyViewSchema = require('../model/propertyView.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');
    const PropertyView = req.getModel('PropertyView', PropertyViewSchema);

    const property = await Property.findById(req.params.id).populate('utilisateur', 'name nom email telephone');
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const ip = getClientIp(req);
    const ipHash = hashIp(ip || 'unknown');

    try {
        await PropertyView.create({
            property: property._id,
            ipHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        property.vues = (property.vues || 0) + 1;
        await property.save();
    } catch (_) {}

    return sendResponse(res, property, 'Détails du bien');
});
