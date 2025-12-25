const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');

    const property = await Property.findById(req.params.id).populate('utilisateur', 'name nom email telephone');
    if (!property || property.isDeleted) return sendResponse(res, null, 'Propriété non trouvée', false);

    return sendResponse(res, property, 'Détails propriété');
});
