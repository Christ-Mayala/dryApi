const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findByIdAndUpdate(
        req.params.id,
        { isDeleted: true, deletedAt: new Date(), status: 'deleted' },
        { new: true },
    );

    if (!property) return sendResponse(res, null, 'Propriété non trouvée', false);

    return sendResponse(res, null, 'Propriété supprimée avec succès');
});
