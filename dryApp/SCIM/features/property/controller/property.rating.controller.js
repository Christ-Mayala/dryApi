const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(req.params.id).populate('evaluations.utilisateur', 'name nom');
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const evalUser = (property.evaluations || []).find((e) => e.utilisateur?._id?.toString() === req.user.id);

    return sendResponse(
        res,
        {
            property,
            userRating: evalUser ? evalUser.note : null,
            averageRating: property.noteMoyenne,
        },
        'Détails du bien + notes',
    );
});
