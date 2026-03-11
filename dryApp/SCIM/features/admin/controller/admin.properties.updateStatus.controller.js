const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { triggerSitemapRegeneration } = require('../../../utils/triggerSitemap');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const status = req.body?.status;
    const property = await Property.findById(req.params.id);

    if (!property || property.isDeleted) return sendResponse(res, null, 'Propriete non trouvee', false);
    property.status = status;
    if (!property.adminReference) property.adminReference = req.user.id;
    await property.save();

    triggerSitemapRegeneration('admin-property-status');
    return sendResponse(res, property, 'Statut mis a jour avec succes');
});
