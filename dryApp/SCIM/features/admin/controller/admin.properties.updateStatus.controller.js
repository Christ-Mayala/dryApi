const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const status = req.body?.status;
    const property = await Property.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!property || property.isDeleted) return sendResponse(res, null, 'Propriété non trouvée', false);

    return sendResponse(res, property, 'Statut mis à jour avec succès');
});
