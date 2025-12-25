const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    const User = req.getModel('User');

    const userId = req.user.id;
    const propertyId = req.params.id;

    const property = await Property.findById(propertyId).select('_id isDeleted');
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const user = await User.findById(userId).select('visited');
    if (!user) return sendResponse(res, null, 'Utilisateur introuvable.', false);

    const visited = user.visited || [];
    const idx = visited.findIndex((v) => v.property?.toString() === propertyId);

    if (idx >= 0) {
        visited[idx].lastVisitedAt = new Date();
        visited[idx].count = (visited[idx].count || 0) + 1;
    } else {
        visited.unshift({ property: propertyId, lastVisitedAt: new Date(), count: 1 });
        if (visited.length > 100) visited.splice(100);
    }

    user.visited = visited;
    await user.save();

    return sendResponse(res, { success: true }, 'Visite enregistrée');
});
